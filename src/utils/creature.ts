import type { Condition } from "src/types/creatures";
import type { HomebrewCreature } from "src/types/creatures";
import type { SRDMonster } from "src/types/creatures";
import type { CreatureState } from "src/types/creatures";
import { Conditions } from ".";
import { DEFAULT_UNDEFINED } from "./constants";
import type InitiativeTracker from "src/main";

export function getId() {
    return "ID_xyxyxyxyxyxy".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export class Creature {
    active: boolean;
    name: string;
    modifier: number | number[];
    hp: number;
    hit_dice?: string;
    rollHP?: boolean;
    temp: number;
    ac: number | string;
    current_ac: number | string;
    dirty_ac: boolean;
    note: string;
    enabled: boolean = true;
    hidden: boolean = false;
    max: number;
    current_max: number;
    level: number;
    player: boolean;
    status: Set<Condition> = new Set();
    marker: string;
    initiative: number;
    static: boolean = false;
    source: string | string[];
    id: string;
    xp: number;
    viewing: boolean = false;
    number = 0;
    display: string;
    friendly: boolean = false;
    "statblock-link": string;
    cr: string | number;
    path: string;
    setModifier(modifier: number[] | number) {
        if (modifier) {
            if (Array.isArray(modifier)) {
                this.modifier = [...modifier];
            }
            if (!isNaN(Number(modifier))) {
                this.modifier = Number(modifier);
            }
        }
        this.modifier = this.modifier ?? 0;
    }
    addCondition(condition: Condition) {
        if (![...this.status].find(cond => cond.name === condition.name && cond.amount === condition.amount)) {
            this.status.add(condition);
        }
    }
    removeCondition(condition: Condition) {
        this.status = new Set(
            [...this.status].filter((s) => s.id != condition.id)
        );    }
    constructor(public creature: HomebrewCreature, initiative: number = 0) {
        this.name = creature.name;
        this.display = creature.display;
        this.initiative =
            "initiative" in creature
                ? (creature as Creature).initiative
                : Number(initiative ?? 0);
        this.static = creature.static ?? false;
        this.setModifier(creature.modifier);
        this.current_ac = this.ac = creature.ac ?? undefined;
        this.dirty_ac = false;
        this.max = this.current_max = creature.hp ? Number(creature.hp) : 0;
        this.note = creature.note;
        this.level = creature.level;
        this.player = creature.player;

        this.rollHP = creature.rollHP;

        this.marker = creature.marker;

        this.hp = this.max;
        this.temp = 0;
        this.source = creature.source;

        this.friendly = creature.friendly ?? this.friendly;

        this.active = creature.active;

        this.hidden = creature.hidden ?? false;

        this.note = creature.note;
        this.path = creature.path;

        this.xp = creature.xp;

        this.cr = creature.cr;
        this.id = creature.id ?? getId();
        if ("statblock-link" in creature) {
            this["statblock-link"] = (creature as any)[
                "statblock-link"
            ] as string;
        }
        if ("hit_dice" in creature && typeof creature.hit_dice == "string") {
            this.hit_dice = creature.hit_dice;
        }
    }
    get hpDisplay() {
        if (this.current_max) {
            const tempMods =
                this.temp > 0
                    ? `aria-label="Temp HP: ${this.temp}" style="font-weight:bold"`
                    : "";
            return `
                <span ${tempMods}>${this.hp + this.temp}</span><span>/${
                this.current_max
            }</span>
            `;
        }
        return DEFAULT_UNDEFINED;
    }

    getName() {
        let name = [this.display ?? this.name];
        /* if (this.display) {
            return this.display;
        } */
        if (this.number > 0) {
            name.push(`${this.number}`);
        }
        return name.join(" ");
    }
    getStatblockLink(): string {
        if ("statblock-link" in this) {
            const value = this["statblock-link"];
            return value.startsWith("#")
                ? `[${this.name}](${this.note}${value})`
                : value;
        }
    }

    *[Symbol.iterator]() {
        yield this.name;
        yield this.initiative;
        yield this.static;
        yield this.modifier;
        yield this.max;
        yield this.ac;
        yield this.note;
        yield this.path;
        yield this.id;
        yield this.marker;
        yield this.xp;
        yield this.hidden;
        yield this.hit_dice;
        yield this.current_ac;
        yield this.rollHP;
    }

    static new(creature: Creature) {
        return new Creature(
            {
                ...creature,
                id: getId()
            },
            creature.initiative
        );
    }

    static from(creature: HomebrewCreature | SRDMonster) {
        const modifier =
            "modifier" in creature
                ? creature.modifier
                : Math.floor(
                      (("stats" in creature && creature.stats.length > 1
                          ? creature.stats[1]
                          : 10) -
                          10) /
                          2
                  );
        return new Creature({
            ...creature,
            modifier: modifier
        });
    }

    update(creature: HomebrewCreature) {
        this.name = creature.name;

        this.setModifier(creature.modifier);

        this.current_max = this.max = creature.hp ? Number(creature.hp) : 0;

        if (this.hp > this.max) this.hp = this.max;

        this.current_ac = this.ac = creature.ac ?? undefined;
        this.note = creature.note;
        this.level = creature.level;
        this.player = creature.player;
        this["statblock-link"] = creature["statblock-link"];

        this.marker = creature.marker;
        this.source = creature.source;
    }

    toProperties() {
        return { ...this };
    }

    toJSON(): CreatureState {
        return {
            name: this.name,
            display: this.display,
            initiative: this.initiative,
            static: this.static,
            modifier: this.modifier,
            hp: this.max,
            currentMaxHP: this.current_max,
            cr: this.cr,
            ac: this.ac,
            currentAC: this.current_ac,
            note: this.note,
            path: this.path,
            id: this.id,
            marker: this.marker,
            currentHP: this.hp,
            tempHP: this.temp,
            status: Array.from(this.status).map((c) => c.name),
            enabled: this.enabled,
            level: this.level,
            player: this.player,
            xp: this.xp,
            active: this.active,
            hidden: this.hidden,
            friendly: this.friendly,
            "statblock-link": this["statblock-link"],
            hit_dice: this.hit_dice,
            rollHP: this.rollHP
        };
    }

    static fromJSON(state: CreatureState, plugin: InitiativeTracker) {
        let creature: Creature;
        if (state.player) {
            creature =
                plugin.getPlayerByName(state.name) ??
                new Creature(state, state.initiative);
            creature.initiative = state.initiative;
        } else {
            creature = new Creature(state, state.initiative);
        }
        creature.enabled = state.enabled;

        creature.temp = state.tempHP ? state.tempHP : 0;
        creature.current_max = state.currentMaxHP;
        creature.hp = state.currentHP;
        creature.current_ac = state.currentAC;
        let statuses: Condition[] = [];
        for (const status of state.status) {
            const existing = Conditions.find(({ name }) => status == name);
            if (existing) {
                statuses.push(existing);
            } else {
                statuses.push({
                    name: status,
                    description: null,
                    id: getId()
                });
            }
        }
        creature.status = new Set(statuses);
        creature.active = state.active;
        return creature;
    }
}
