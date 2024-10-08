import { Creature, getId } from "src/utils/creature";
import type InitiativeTracker from "../../main";
import {
    derived,
    get,
    type Updater,
    type Writable,
    writable
} from "svelte/store";
import { equivalent } from "../../encounter";
import { Events, Platform, TFile } from "obsidian";
import type { UpdateLogMessage } from "src/logger/logger.types";
import type { Condition } from "src/types/creatures";
import type { InitiativeTrackerData } from "src/settings/settings.types";
import type { InitiativeViewState } from "../view.types";
import {
    OVERFLOW_TYPE,
    RollPlayerInitiativeBehavior,
    getRpgSystem
} from "src/utils";
import type Logger from "../../logger/logger";
import type {
    DifficultyLevel,
    DifficultyThreshold
} from "src/utils/rpg-system";
import type { StackRoller } from "@javalent/dice-roller";

type HPUpdate = {
    saved: boolean;
    resist: boolean;
    customMod: "2" | "1";
};
type CreatureUpdate = {
    hp?: number;
    ac?: number | string;
    current_ac?: number | string;
    initiative?: number;
    name?: string;
    marker?: string;
    temp?: number;
    max?: number;
    status?: Condition[];
    remove_status?: Condition[];
    hidden?: boolean;
    enabled?: boolean;
    //this is so dirty
    set_hp?: number;
    set_max_hp?: number;
};
type CreatureUpdates = { creature: Creature; change: CreatureUpdate };
const modifier = Platform.isMacOS ? "Meta" : "Control";
function createTracker() {
    const creatures = writable<Creature[]>([]);
    const updating = writable<Map<Creature, HPUpdate>>(new Map());
    const updateTarget = writable<"ac" | "hp">();
    const { subscribe, set, update } = creatures;

    const $logFile = writable<TFile | null>();

    let _logger: Logger;

    const $round = writable<number>(1);
    const $state = writable<boolean>(false);
    const setState = (state: boolean) => {
        $state.set(state);
        if (state) {
            if (!_logger?.logging) {
                _logger
                    ?.new({
                        name: get($name)!,
                        players: current_order.filter((c) => c.player),
                        creatures: current_order.filter((c) => !c.player),
                        round: get($round)
                    })
                    .then(() => {
                        $logFile.set(_logger.getFile());
                    });
            } else {
                _logger?.log(`Combat re-started`);
            }
        } else {
            _logger?.log("Combat stopped");
        }
        updateAndSave((creatures) => {
            if (creatures.length && !creatures.find((c) => c.active)) {
                current_order[0].active = true;
            }
            return creatures;
        });
    };
    const $name = writable<string | null>();
    const $party = writable<string | null>();

    const data = writable<InitiativeTrackerData>();
    const descending = derived(data, (data) => {
        return data.descending;
    });
    let _settings: InitiativeTrackerData | null;

    const condensed = derived(creatures, (values) => {
        if (_settings?.condense) {
            values.forEach((creature, _, arr) => {
                const equiv = arr.filter((c) => equivalent(c, creature));
                const initiatives = equiv.map((i) => i.initiative);
                const initiative =
                    initiatives[Math.floor(Math.random() * initiatives.length)];
                equiv.forEach((eq) => {
                    if (eq.static) return;
                    eq.initiative = initiative;
                });
            });
        }
        return values;
    });

    let current_order: Creature[] = [];
    const ordered = derived([condensed, data], ([values, data]) => {
        const sort = [...values];
        sort.sort((a, b) => {
            return data.descending
                ? b.initiative - a.initiative
                : a.initiative - b.initiative;
        });
        current_order = sort;
        return sort;
    });

    const logNewInitiative = (creature: Creature) => {
        _logger?.log(
            `${creature.getName()} initiative changed to ${creature.initiative}`
        );
    };

    const performCreatureUpdate = (
        creatures: Creature[],
        ...updates: CreatureUpdates[]
    ) => {
        for (const { creature, change } of updates) {
            if (change.initiative) {
                creature.initiative = Number(change.initiative);
                logNewInitiative(creature);
            }
            if (change.name) {
                creature.name = change.name;
                creature.number = 0;
            }
            if (change.hp) {
                // Reduce temp HP first
                change.hp = Number(change.hp);
                if (change.hp < 0 && creature.temp > 0) {
                    const remaining = creature.temp + change.hp;
                    creature.temp = Math.max(0, remaining);
                    change.hp = Math.min(0, remaining);
                }
                // Clamp HP at 0 if clamp is enabled in settings
                if (_settings.clamp && creature.hp + change.hp < 0) {
                    change.hp = -creature.hp;
                }
                // Handle overflow healing according to settings
                if (
                    change.hp > 0 &&
                    change.hp + creature.hp > creature.current_max
                ) {
                    switch (_settings.hpOverflow) {
                        case OVERFLOW_TYPE.ignore:
                            change.hp = Math.max(
                                creature.current_max - creature.hp,
                                0
                            );
                            break;
                        case OVERFLOW_TYPE.temp:
                            // Gives temp a value, such that it will be set later
                            change.temp =
                                change.hp -
                                Math.min(creature.current_max - creature.hp, 0);
                            change.hp -= change.temp;
                            break;
                        case OVERFLOW_TYPE.current:
                            break;
                    }
                }
                creature.hp += change.hp;
                if (_settings.autoStatus && creature.hp <= 0) {
                    const unc = _settings.statuses.find(
                        (s) => s.id == _settings.unconsciousId
                    );
                    if (unc) creature.addCondition(unc);
                }
            }
            if (change.max) {
                creature.current_max = Math.max(
                    0,
                    creature.current_max + change.max
                );
                if (
                    creature.hp >= creature.current_max &&
                    _settings.hpOverflow !== OVERFLOW_TYPE.current
                ) {
                    creature.hp = creature.current_max;
                }
            }
            if (change.set_hp) {
                creature.hp = change.set_hp;
            }
            if (change.set_max_hp) {
                creature.current_max = creature.max = change.set_max_hp;
            }
            if (change.ac) {
                creature.current_ac = creature.ac = change.ac;
            }
            if (change.temp) {
                let baseline = 0;
                if (_settings.additiveTemp) {
                    baseline = creature.temp;
                }
                if (change.temp > 0) {
                    creature.temp = Math.max(
                        creature.temp,
                        baseline + change.temp
                    );
                } else {
                    creature.temp = Math.max(0, creature.temp + change.temp);
                }
            }
            if (change.marker) {
                creature.marker = change.marker;
            }
            if (change.status?.length) {
                for (const status of change.status) {
                    creature.addCondition(status);
                }
            }
            if (change.remove_status?.length) {
                for (const status of change.remove_status) {
                    creature.removeCondition(status);
                }
            }
            if ("hidden" in change) {
                creature.hidden = change.hidden!;
                _logger.log(
                    `${creature.getName()} ${
                        creature.hidden ? "hidden" : "revealed"
                    }`
                );
            }
            if ("enabled" in change) {
                creature.enabled = change.enabled!;
                _logger.log(
                    `${creature.getName()} ${
                        creature.enabled ? "enabled" : "disabled"
                    }`
                );
            }
            if (!creatures.includes(creature)) {
                creatures.push(creature);
            }
        }
        return creatures;
    };
    const updateCreatures = (...updates: CreatureUpdates[]) =>
        updateAndSave((creatures) => {
            return performCreatureUpdate(creatures, ...updates);
        });

    const getEncounterState = (): InitiativeViewState => {
        return {
            creatures: get(creatures).map((c) => c.toJSON()),
            state: get($state),
            name: get($name)!,
            round: get($round),
            logFile: _logger?.getLogFile() ?? null,
            rollHP: false
        };
    };

    const trySave = () => {
        app.workspace.trigger(
            "initiative-tracker:save-state",
            getEncounterState()
        );
    };

    function updateAndSave(updater: Updater<Creature[]>): void {
        update(updater);
        trySave();
    }

    const setNumbers = (list: Creature[]) => {
        for (let i = 0; i < list.length; i++) {
            const creature = list[i];
            if (
                creature.player ||
                list.filter((c) => c.name == creature.name).length == 1
            ) {
                continue;
            }
            if (creature.number > 0) continue;
            const prior = list
                .filter((c) =>
                    c.display
                        ? c.display == creature.display
                        : c.name == creature.name
                )
                .map((c) => c.number);

            creature.number = prior?.length ? Math.max(...prior) + 1 : 1;
        }
    };

    function rollIntiative(
        plugin: InitiativeTracker,
        creatures: Creature[]
    ): Creature[] {
        for (let creature of creatures) {
            if (creature.static && creature.initiative) continue;
            creature.active = false;
            if (
                creature.player &&
                plugin.data.rollPlayerInitiatives ==
                    RollPlayerInitiativeBehavior.Never
            )
                continue;
            if (
                creature.player &&
                plugin.data.rollPlayerInitiatives ==
                    RollPlayerInitiativeBehavior.SetToZero
            ) {
                creature.initiative = 0;
            } else {
                creature.initiative = plugin.getInitiativeValue(
                    creature.modifier
                );
            }
        }
        return creatures;
    }

    return {
        subscribe,
        set,

        data,
        setData: (settings: InitiativeTrackerData) => {
            data.set(settings);
            _settings = settings;
        },

        getLogger: () => _logger,

        setLogger: (logger: Logger) => {
            _logger = logger;
        },

        updating,
        updateTarget,
        updateCreatures,
        updateCreatureByName: (name: string, change: CreatureUpdate) =>
            updateAndSave((creatures) => {
                const creature = creatures.find((c) => c.name == name);
                if (creature) {
                    if (!isNaN(Number(change.hp))) {
                        creature.hp = change.hp;
                    }
                    if (change.max) {
                        creature.current_max = Math.max(
                            0,
                            creature.current_max + change.max
                        );
                        if (
                            creature.hp >= creature.current_max &&
                            _settings.hpOverflow !== OVERFLOW_TYPE.current
                        ) {
                            creature.hp = creature.current_max;
                        }
                    }
                    if (change.temp) {
                        let baseline = 0;
                        if (_settings.additiveTemp) {
                            baseline = creature.temp;
                        }
                        if (change.temp > 0) {
                            creature.temp = Math.max(
                                creature.temp,
                                baseline + change.temp
                            );
                        } else {
                            creature.temp = Math.max(
                                0,
                                creature.temp + change.temp
                            );
                        }
                    }
                    if (change.marker) {
                        creature.marker = change.marker;
                    }
                    if (
                        typeof change.ac == "string" ||
                        !isNaN(Number(change.ac))
                    ) {
                        creature.ac = creature.current_ac = change.ac;
                    }
                    if (
                        typeof change.current_ac == "string" ||
                        !isNaN(Number(change.current_ac))
                    ) {
                        creature.current_ac = change.ac;
                    }
                    if (!isNaN(Number(change.initiative))) {
                        creature.initiative = change.initiative;
                    }
                    if (typeof change.name == "string") {
                        creature.name = change.name;
                    }
                    if ("hidden" in change) {
                        creature.hidden = change.hidden;
                    }
                    if ("enabled" in change) {
                        creature.enabled = change.enabled;
                    }
                    if (Array.isArray(change.status) && change.status?.length) {
                        for (const status of change.status) {
                            if (typeof status == "string") {
                                let cond = _settings.statuses.find(
                                    (c) => c.name == status
                                ) ?? {
                                    name: status,
                                    description: "",
                                    id: getId()
                                };
                                creature.addCondition(cond);
                            } else if (
                                typeof status == "object" &&
                                status.name?.length
                            ) {
                                creature.addCondition(status as Condition);
                            }
                        }
                    }
                }

                return creatures;
            }),

        players: derived(ordered, (creatures) =>
            creatures.filter((c) => c.player)
        ),

        setUpdate: (creature: Creature, evt: MouseEvent) =>
            updating.update((creatures) => {
                if (creatures.has(creature)) {
                    creatures.delete(creature);
                } else {
                    creatures.set(creature, {
                        saved: evt.getModifierState("Shift"),
                        resist: evt.getModifierState(modifier),
                        customMod: evt.getModifierState("Alt") ? "2" : "1"
                    });
                }
                return creatures;
            }),
        doUpdate: (toAddString: string, statuses: Condition[], ac: string, removeStatuses: Condition[] = []) =>
            updating.update((updatingCreatures) => {
                const messages: UpdateLogMessage[] = [];
                const updates: CreatureUpdates[] = [];

                updatingCreatures.forEach((entry, creature) => {
                    const roundHalf = !toAddString.includes(".");
                    const change: CreatureUpdate = {};
                    const modifier =
                        (entry.saved ? 0.5 : 1) *
                        (entry.resist ? 0.5 : 1) *
                        Number(entry.customMod);
                    const name = [creature.name];
                    if (creature.number > 0) {
                        name.push(`${creature.number}`);
                    }
                    const message: UpdateLogMessage = {
                        name: name.join(" "),
                        hp: null,
                        temp: false,
                        max: false,
                        status: null,
                        remove_status: null,
                        saved: false,
                        unc: false,
                        ac: null,
                        ac_add: false
                    };

                    if (toAddString.charAt(0) == "t") {
                        let toAdd = Number(toAddString.slice(1));
                        message.hp = toAdd;
                        message.temp = true;
                        change.temp = toAdd;
                    } else {
                        const maxHpDamage = toAddString.charAt(0) === "m";
                        let toAdd = Number(toAddString.slice(+maxHpDamage));
                        toAdd =
                            -1 *
                            Math.sign(toAdd) *
                            Math.max(Math.abs(toAdd) * modifier, 1);
                        toAdd = roundHalf ? Math.trunc(toAdd) : toAdd;
                        message.hp = toAdd;
                        if (maxHpDamage) {
                            message.max = true;
                            change.max = toAdd;
                        }
                        change.hp = toAdd;
                        if (creature.hp <= 0) {
                            message.unc = true;
                        }
                    }
                    if (statuses.length) {
                        message.status = statuses.map((s) => s.name);
                        if (!entry.saved) {
                            change.status = [...statuses];
                        } else {
                            message.saved = true;
                        }
                    }
                    if (removeStatuses.length) {
                        change.remove_status = [...removeStatuses];
                    }
                    if (ac) {
                        if (ac.charAt(0) == "+" || ac.charAt(0) == "-") {
                            const current_ac = parseInt(
                                String(creature.current_ac)
                            );
                            if (isNaN(current_ac)) {
                                creature.current_ac = creature.current_ac + ac;
                            } else {
                                creature.current_ac = current_ac + parseInt(ac);
                            }
                            message.ac_add = true;
                        } else {
                            creature.current_ac = ac.slice(
                                Number(ac.charAt(0) == "\\")
                            );
                        }
                        message.ac = ac.slice(Number(ac.charAt(0) == "\\"));
                    }
                    messages.push(message);
                    updates.push({ creature, change });
                });
                _logger?.logUpdate(messages);
                updateCreatures(...updates);
                updatingCreatures.clear();
                return updatingCreatures;
            }),
        clearUpdate: () =>
            updating.update((updates) => {
                updates.clear();
                return updates;
            }),

        round: $round,

        name: $name,

        sort: descending,

        party: $party,
        setParty: (party: string, plugin: InitiativeTracker) =>
            updateAndSave((creatures) => {
                const players = plugin.getPlayersForParty(party);
                $party.set(party);
                creatures = [...creatures.filter((c) => !c.player), ...players];
                return creatures;
            }),

        state: $state,
        getState: () => get($state),
        toggleState: () => {
            setState(!get($state));
        },
        setState,

        goToNext: () =>
            updateAndSave((creatures) => {
                const current = current_order.findIndex((c) => {
                    return c.active;
                });
                if (current == -1) {
                    current_order[0].active = true;
                } else {
                    let next;
                    let nextIndex = current;
                    do {
                        nextIndex =
                            (((nextIndex + 1) % current_order.length) +
                                current_order.length) %
                            current_order.length;
                        next = current_order[nextIndex];
                        if (nextIndex == current) {
                            break;
                        }
                    } while (!next.enabled);

                    if (next) {
                        current_order[current].active = false;
                        if (nextIndex < current) {
                            const round = get($round) + 1;
                            $round.set(round);

                            for (const creature of creatures) {
                                creature.status = new Set(
                                    [...creature.status].filter(
                                        (s) => !s.resetOnRound
                                    )
                                );
                            }

                            _logger?.log("###", `Round ${round}`);
                        }
                        _logger?.log("#####", `${next.getName()}'s turn`);
                        next.active = true;
                    }
                }
                return creatures;
            }),
        goToPrevious: () =>
            updateAndSave((creatures) => {
                const current = current_order.findIndex((c) => {
                    return c.active;
                });
                if (current == 0 && get($round) == 1) return creatures;

                if (current == -1) {
                    current_order[0].active = true;
                } else {
                    let prev;
                    let prevIndex = current;
                    do {
                        prevIndex =
                            (((prevIndex - 1) % current_order.length) +
                                current_order.length) %
                            current_order.length;
                        prev = current_order[prevIndex];
                        if (prevIndex == current) {
                            break;
                        }
                    } while (!prev.enabled);

                    if (prev) {
                        current_order[current].active = false;
                        if (prevIndex > current) {
                            const round = get($round) - 1;
                            $round.set(round);
                            for (const creature of creatures) {
                                creature.status = new Set(
                                    [...creature.status].filter(
                                        (s) => !s.resetOnRound
                                    )
                                );
                            }
                            _logger?.log("###", `Round ${round}`);
                        }
                        _logger?.log("#####", `${prev.getName()}'s turn`);
                        prev.active = true;
                    }
                }
                return creatures;
            }),

        ordered,

        add: async (
            plugin: InitiativeTracker,
            roll: boolean = plugin.data.rollHP,
            ...items: Creature[]
        ) =>
            updateAndSave((creatures) => {
                if (plugin.canUseDiceRoller && roll) {
                    setCreatureHP(items, plugin, roll);
                }

                creatures.push(...items);
                const toRoll: Creature[] = [];
                if (!_settings.condense) {
                    toRoll.push(...items);
                } else {
                    for (const creature of items) {
                        const existing = current_order.find((c) =>
                            equivalent(c, creature)
                        );
                        if (existing) {
                            creature.initiative = existing.initiative;
                        } else {
                            toRoll.push(creature);
                        }
                    }
                }
                rollIntiative(plugin, toRoll);
                _logger?.log(
                    _logger?.join(items.map((c) => c.name)),
                    "added to the combat."
                );
                setNumbers(creatures);
                return creatures;
            }),
        remove: (...items: Creature[]) =>
            updateAndSave((creatures) => {
                creatures = creatures.filter((m) => !items.includes(m));

                _logger?.log(
                    _logger?.join(items.map((c) => c.name)),
                    "removed from the combat."
                );
                return creatures;
            }),
        replace: (old: Creature, replacer: Creature) => {
            updateAndSave((creatures) => {
                creatures.splice(creatures.indexOf(old), 1, replacer);
                setNumbers(creatures);
                return creatures;
            });
        },
        update: () => update((c) => c),
        updateAndSave: () => updateAndSave((c) => c),
        roll: (plugin: InitiativeTracker) =>
            updateAndSave((creatures) => {
                rollIntiative(plugin, creatures);
                return creatures;
            }),
        new: (plugin: InitiativeTracker, state?: InitiativeViewState) =>
            updateAndSave((creatures) => {
                $round.set(state?.round ?? 1);
                $state.set(state?.state ?? false);
                $name.set(state?.name ?? null);

                if (!state?.creatures) {
                    /**
                     * New encounter button was clicked, only maintain the players.
                     */
                    creatures = creatures.filter((c) => c.player);
                } else {
                    /**
                     * Encounter is being started. Keep any pre-existing players that are incoming.
                     */
                    const tempCreatureArray: Creature[] = [];

                    const party = get($party);
                    const players = new Map(
                        [
                            ...(party ? plugin.getPlayersForParty(party) : []),
                            ...creatures.filter((p) => p.player)
                        ].map((c) => [c.id, c])
                    ).values();
                    for (const creature of state.creatures) {
                        /* const ; */
                        let existingPlayer: Creature | null = null;
                        if (
                            creature.player &&
                            (existingPlayer = creatures.find(
                                (c) => c.player && c.id === creature.id
                            )) &&
                            existingPlayer != null
                        ) {
                            tempCreatureArray.push(existingPlayer);
                        } else {
                            tempCreatureArray.push(
                                Creature.fromJSON(creature, plugin)
                            );
                        }
                    }
                    for (const player of players) {
                        if (
                            !tempCreatureArray.find(
                                (p) => p.player && p.id == player.id
                            )
                        ) {
                            tempCreatureArray.push(player);
                        }
                    }
                    creatures = tempCreatureArray;
                }
                if (!state || state?.roll) {
                    rollIntiative(plugin, creatures);
                }
                setNumbers(creatures);
                if (
                    plugin.canUseDiceRoller &&
                    (state?.rollHP ?? plugin.data.rollHP)
                ) {
                    setCreatureHP(creatures, plugin);
                }

                if (state?.logFile) {
                    _logger?.new(state.logFile).then(() => {
                        $logFile.set(_logger.getFile());
                    });
                }
                if ((!state && _logger) || state?.newLog) {
                    _logger.logging = false;
                    $logFile.set(null);
                }
                return creatures;
            }),
        reset: () =>
            updateAndSave((creatures) => {
                for (let creature of creatures) {
                    creature.current_ac = creature.ac;
                    creature.hp = creature.current_max = creature.max;
                    creature.enabled = true;
                    creature.status.clear();
                }
                _logger?.log("Encounter HP & Statuses reset");
                return creatures;
            }),

        getOrderedCreatures: () => get(ordered),
        logUpdate: (messages: UpdateLogMessage[]) => {
            const toLog: string[] = [];
            for (const message of messages) {
                const perCreature: string[] = [];
                if (message.hp) {
                    if (message.temp) {
                        perCreature.push(
                            `${
                                message.name
                            } gained ${message.hp.toString()} temporary HP`
                        );
                    } else if (message.max) {
                        if (message.hp < 0) {
                            perCreature.push(
                                `${message.name} took ${(
                                    -1 * message.hp
                                ).toString()} max HP damage${
                                    message.unc ? " and died" : ""
                                }`
                            );
                        } else {
                            perCreature.push(
                                `${message.name} gained ${(
                                    -1 * message.hp
                                ).toString()} max HP`
                            );
                        }
                    } else if (message.hp < 0) {
                        perCreature.push(
                            `${message.name} took ${(
                                -1 * message.hp
                            ).toString()} damage${
                                message.unc
                                    ? " and was knocked unconscious"
                                    : ""
                            }`
                        );
                    } else if (message.hp > 0) {
                        perCreature.push(
                            `${
                                message.name
                            } was healed for ${message.hp.toString()} HP`
                        );
                    }
                }
                if (message.status) {
                    if (perCreature.length) {
                        perCreature.push("and");
                    } else {
                        perCreature.push(message.name);
                    }
                    if (message.saved) {
                        perCreature.push(`saved against ${message.status}`);
                    } else {
                        perCreature.push(`took ${message.status} status`);
                    }
                }
                toLog.push(perCreature.join(" "));
            }
            _logger?.log(`${toLog.join(". ")}.`);
        },
        logNewInitiative,
        logFile: $logFile,

        getEncounterState,

        updateState: () => update((c) => c),

        difficulty: (plugin: InitiativeTracker) =>
            derived([creatures, data], ([values]) => {
                const players: number[] = [];
                const creatureMap = new Map<Creature, number>();
                const rpgSystem = getRpgSystem(plugin);

                for (const creature of values) {
                    if (!creature.enabled) continue;
                    if (creature.friendly) continue;
                    if (creature.player && creature.level) {
                        players.push(creature.level);
                        continue;
                    }
                    const stats = {
                        name: creature.name,
                        display: creature.display,
                        ac: creature.ac,
                        hp: creature.hp,
                        modifier: creature.modifier,
                        xp: creature.xp,
                        hidden: creature.hidden
                    };
                    const existing = [...creatureMap].find(([c]) =>
                        equivalent(c, stats)
                    );
                    if (!existing) {
                        creatureMap.set(creature, 1);
                        continue;
                    }
                    creatureMap.set(existing[0], existing[1] + 1);
                }
                return {
                    difficulty: rpgSystem.getEncounterDifficulty(
                        creatureMap,
                        players
                    ),
                    thresholds: rpgSystem.getDifficultyThresholds(players),
                    labels: rpgSystem.systemDifficulties
                };
            })
    };
}

export const tracker = createTracker();

function setCreatureHP(
    creatures: Creature[],
    plugin: InitiativeTracker,
    rollHP = false
) {
    for (const creature of creatures) {
        if (!creature.rollHP && !rollHP) continue;
        if (!creature.hit_dice?.length) continue;
        let roller = plugin.getRoller(creature.hit_dice);
        if (!roller) continue;
        creature.hp = creature.max = creature.current_max = roller.rollSync();
    }
}

/* export const tracker = new Tracker(); */
//TODO
class Tracker {
    #bus = new Events();

    #data: InitiativeTrackerData;
    #initiativeCallback: (modifier: number) => number;
    #initialized = false;
    /**
     * Initialize the tracker. The main plugin should be
     * the only thing to call this.
     */
    public initialize(
        data: InitiativeTrackerData,
        logger: Logger,
        initiativeCallback: (modifier: number) => number
    ) {
        this.#data = data;
        this.#initiativeCallback = initiativeCallback;
        this.#logger = logger;
        this.#initialized = true;
        this.#bus.trigger("initialized");
    }
    async isInitialized(): Promise<void> {
        return new Promise((resolve) => {
            if (this.#initialized) resolve();
            this.#bus.on("initialized", () => resolve());
        });
    }

    /** All creatures in the encounter. Includes players. */
    #creatures = writable<Creature[]>([]);
    /** All creatures, ordered by initiative. */
    ordered = derived(this.#creatures, (values) => {
        const sort = [...values];
        sort.sort((a, b) => {
            return this.#data.descending
                ? b.initiative - a.initiative
                : a.initiative - b.initiative;
        });
        this.#current_order = sort;
        return sort;
    });
    /** Static, non-store list. Populated during the order store update. */
    #current_order: Creature[] = [];
    /** Just players. */
    #players = derived(this.#creatures, (creatures) =>
        creatures.filter((c) => c.player)
    );
    /** Just combatants. */
    #combatants = derived(this.#creatures, (creatures) =>
        creatures.filter((c) => !c.player)
    );
    /** Enemies. */
    #enemies = derived(this.#combatants, (combatants) =>
        combatants.filter((c) => !c.friendly)
    );
    /** Allies */
    #allies = derived(this.#combatants, (combatants) =>
        combatants.filter((c) => c.friendly)
    );

    /** Encounter state. */
    round = writable(1);
    active = writable(false);
    getState() {
        return get(this.active);
    }
    setState(state: boolean) {
        this.active.set(state);
        if (state) {
            if (!this.#logger.logging) {
                this.#logger.new({
                    name: get(this.name)!,
                    players: this.#current_order.filter((c) => c.player),
                    creatures: this.#current_order.filter((c) => !c.player),
                    round: get(this.round)
                });
            } else {
                this.tryLog(`Combat re-started`);
            }
        } else {
            this.tryLog("Combat stopped");
        }
        this.#updateAndSave((creatures) => {
            if (creatures.length && !creatures.find((c) => c.active)) {
                this.#current_order[0].active = true;
            }
            return creatures;
        });
    }
    name = writable<string | null>();
    party = writable<string | null>();
    getEncounterState(): InitiativeViewState {
        return {
            creatures: get(this.#creatures).map((c) => c.toJSON()),
            state: get(this.active),
            name: get(this.name)!,
            round: get(this.round),
            logFile: this.#logger?.getLogFile() ?? null,
            rollHP: false
        };
    }
    /**
     * The svelte store contract.
     * Expose the creature store, so this class can be
     * used directly as the creature store in svelte files.
     */
    subscribe = this.#creatures.subscribe;
    set = this.#creatures.set;
    update = this.#creatures.update;
    #updateAndSave(updater: Updater<Creature[]>) {
        this.update(updater);
        app.workspace.trigger(
            "initiative-tracker:save-state",
            this.getEncounterState()
        );
    }

    new(state: InitiativeViewState) {}
    add(roll: boolean = this.#data.rollHP, ...items: Creature[]) {}
    remove(...items: Creature[]) {}

    /**
     * Logging
     */
    #logger: Logger;
    tryLog(...msg: string[]) {
        if (this.#logger) {
            this.#logger.log(...msg);
        }
    }

    /** Creature updates */
    updating = writable<Map<Creature, HPUpdate>>(new Map());
    updateTarget = writable<"ac" | "hp">();
    updateCreatures(...updates: CreatureUpdates[]) {
        this.#updateAndSave((creatures) => {
            return this.performCreatureUpdate(creatures, ...updates);
        });
    }
    performCreatureUpdate(
        creatures: Creature[],
        ...updates: CreatureUpdates[]
    ) {
        for (const { creature, change } of updates) {
            if (change.initiative) {
                creature.initiative = Number(change.initiative);
                this.tryLog(
                    `${creature.getName()} initiative changed to ${
                        creature.initiative
                    }`
                );
            }
            if (change.name) {
                creature.name = change.name;
                creature.number = 0;
            }
            if (change.hp) {
                // Reduce temp HP first
                change.hp = Number(change.hp);
                if (change.hp < 0 && creature.temp > 0) {
                    const remaining = creature.temp + change.hp;
                    creature.temp = Math.max(0, remaining);
                    change.hp = Math.min(0, remaining);
                }
                // Clamp HP at 0 if clamp is enabled in settings
                if (this.#data.clamp && creature.hp + change.hp < 0) {
                    change.hp = -creature.hp;
                }
                // Handle overflow healing according to settings
                if (
                    change.hp > 0 &&
                    change.hp + creature.hp > creature.current_max
                ) {
                    switch (this.#data.hpOverflow) {
                        case OVERFLOW_TYPE.ignore:
                            change.hp = Math.max(
                                creature.current_max - creature.hp,
                                0
                            );
                            break;
                        case OVERFLOW_TYPE.temp:
                            // Gives temp a value, such that it will be set later
                            change.temp =
                                change.hp -
                                Math.min(creature.current_max - creature.hp, 0);
                            change.hp -= change.temp;
                            break;
                        case OVERFLOW_TYPE.current:
                            break;
                    }
                }
                creature.hp += change.hp;
                if (this.#data.autoStatus && creature.hp <= 0) {
                    const unc = this.#data.statuses.find(
                        (s) => s.id == this.#data.unconsciousId
                    );
                    if (unc) creature.addCondition(unc);
                }
            }
            if (change.max) {
                creature.current_max = Math.max(
                    0,
                    creature.current_max + change.max
                );
                if (
                    creature.hp >= creature.current_max &&
                    this.#data.hpOverflow !== OVERFLOW_TYPE.current
                ) {
                    creature.hp = creature.current_max;
                }
            }
            if (change.set_hp) {
                creature.hp = change.set_hp;
            }
            if (change.set_max_hp) {
                creature.current_max = creature.max = change.set_max_hp;
            }
            if (change.ac) {
                creature.current_ac = creature.ac = change.ac;
            }
            if (change.temp) {
                let baseline = 0;
                if (this.#data.additiveTemp) {
                    baseline = creature.temp;
                }
                if (change.temp > 0) {
                    creature.temp = Math.max(
                        creature.temp,
                        baseline + change.temp
                    );
                } else {
                    creature.temp = Math.max(0, creature.temp + change.temp);
                }
            }
            if (change.marker) {
                creature.marker = change.marker;
            }
            if (change.status?.length) {
                for (const status of change.status) {
                    creature.addCondition(status);
                }
            }
            if (change.remove_status?.length) {
                for (const status of change.remove_status) {
                    creature.removeCondition(status);
                    this.tryLog(
                        `${creature.name} relieved of status ${status.name}`
                    );
                }
            }
            if ("hidden" in change) {
                creature.hidden = change.hidden!;
                this.tryLog(
                    `${creature.getName()} ${
                        creature.hidden ? "hidden" : "revealed"
                    }`
                );
            }
            if ("enabled" in change) {
                creature.enabled = change.enabled!;
                this.tryLog(
                    `${creature.getName()} ${
                        creature.enabled ? "enabled" : "disabled"
                    }`
                );
            }
            if (!creatures.includes(creature)) {
                creatures.push(creature);
            }
        }
        return creatures;
    }
    setUpdate(creature: Creature, evt: MouseEvent) {
        this.updating.update((creatures) => {
            if (creatures.has(creature)) {
                creatures.delete(creature);
            } else {
                creatures.set(creature, {
                    saved: evt.getModifierState("Shift"),
                    resist: evt.getModifierState(modifier),
                    customMod: evt.getModifierState("Alt") ? "2" : "1"
                });
            }
            return creatures;
        });
    }
    doUpdate(toAddString: string, statuses: Condition[], ac: string, removeStatuses: Condition[]) {
        this.updating.update((updatingCreatures) => {
            const messages: UpdateLogMessage[] = [];
            const updates: CreatureUpdates[] = [];

            updatingCreatures.forEach((entry, creature) => {
                const roundHalf = !toAddString.includes(".");
                const change: CreatureUpdate = {};
                const modifier =
                    (entry.saved ? 0.5 : 1) *
                    (entry.resist ? 0.5 : 1) *
                    Number(entry.customMod);
                const name = [creature.name];
                if (creature.number > 0) {
                    name.push(`${creature.number}`);
                }
                const message: UpdateLogMessage = {
                    name: name.join(" "),
                    hp: null,
                    temp: false,
                    max: false,
                    status: null,
                    remove_status: null,
                    saved: false,
                    unc: false,
                    ac: null,
                    ac_add: false
                };

                if (toAddString.charAt(0) == "t") {
                    let toAdd = Number(toAddString.slice(1));
                    message.hp = toAdd;
                    message.temp = true;
                    change.temp = toAdd;
                } else {
                    const maxHpDamage = toAddString.charAt(0) === "m";
                    let toAdd = Number(toAddString.slice(+maxHpDamage));
                    toAdd =
                        -1 *
                        Math.sign(toAdd) *
                        Math.max(Math.abs(toAdd) * modifier, 1);
                    toAdd = roundHalf ? Math.trunc(toAdd) : toAdd;
                    message.hp = toAdd;
                    if (maxHpDamage) {
                        message.max = true;
                        change.max = toAdd;
                    }
                    change.hp = toAdd;
                    if (creature.hp <= 0) {
                        message.unc = true;
                    }
                }
                if (statuses.length) {
                    message.status = statuses.map((s) => s.name);
                    if (!entry.saved) {
                        change.status = [...statuses];
                    } else {
                        message.saved = true;
                    }
                }
                if (removeStatuses.length) {
                    message.remove_status = removeStatuses.map((s) => s.name);
                    change.remove_status = [...removeStatuses]
                }
                if (ac) {
                    if (ac.charAt(0) == "+" || ac.charAt(0) == "-") {
                        const current_ac = parseInt(
                            String(creature.current_ac)
                        );
                        if (isNaN(current_ac)) {
                            creature.current_ac = creature.current_ac + ac;
                        } else {
                            creature.current_ac = current_ac + parseInt(ac);
                        }
                        message.ac_add = true;
                    } else {
                        creature.current_ac = ac.slice(
                            Number(ac.charAt(0) == "\\")
                        );
                    }
                    message.ac = ac.slice(Number(ac.charAt(0) == "\\"));
                }
                messages.push(message);
                updates.push({ creature, change });
            });
            this.#logger?.logUpdate(messages);
            this.updateCreatures(...updates);
            updatingCreatures.clear();
            return updatingCreatures;
        });
    }
    clearUpdate() {
        this.updating.update((updates) => {
            updates.clear();
            return updates;
        });
    }
}
