import {
    addIcon,
    ExtraButtonComponent,
    normalizePath,
    Notice,
    PluginSettingTab,
    setIcon,
    Setting,
    TextComponent,
    TFolder
} from "obsidian";

import type InitiativeTracker from "../main";

import { PlayerSuggestionModal } from "../utils/suggester";
import { FileInputSuggest, FolderInputSuggest } from "obsidian-utilities";
import {
    AC,
    Conditions,
    DEFAULT_UNDEFINED,
    EDIT,
    HP,
    INITIATIVE
} from "../utils";
import { RpgSystemSetting, getRpgSystem } from "../utils/rpg-system";
import type { Party } from "./settings.types";
import type { InputValidate } from "./settings.types";
import type { Condition } from "src/types/creatures";
import type { HomebrewCreature } from "src/types/creatures";

export default class InitiativeTrackerSettings extends PluginSettingTab {
    constructor(private plugin: InitiativeTracker) {
        super(plugin.app, plugin);
    }
    async display(): Promise<void> {
        try {
            let { containerEl } = this;

            containerEl.empty();
            containerEl.addClass("initiative-tracker-settings");

            containerEl.createEl("h2", { text: "Initiative Tracker Settings" });

            this._displayBase(containerEl.createDiv());
            if (!this.plugin.data.openState) {
                this.plugin.data.openState = {
                    battle: true,
                    player: true,
                    party: true,
                    plugin: true,
                    status: true,
                    builder: true
                };
            }
            this._displayBattle(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.player
                            ? { open: true }
                            : {})
                    }
                })
            );
            this._displayPlayers(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.player
                            ? { open: true }
                            : {})
                    }
                })
            );
            this._displayParties(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.party
                            ? { open: true }
                            : {})
                    }
                })
            );
            this._displayBuilder(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.builder
                            ? { open: true }
                            : {})
                    }
                })
            );
            this._displayStatuses(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.status
                            ? { open: true }
                            : {})
                    }
                })
            );
            this._displayIntegrations(
                containerEl.createEl("details", {
                    cls: "initiative-tracker-additional-container",
                    attr: {
                        ...(this.plugin.data.openState.plugin
                            ? { open: true }
                            : {})
                    }
                })
            );

            const div = containerEl.createDiv("coffee");
            div.createEl("a", {
                href: "https://www.buymeacoffee.com/valentine195"
            }).createEl("img", {
                attr: {
                    src: "https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=valentine195&button_colour=e3e7ef&font_colour=262626&font_family=Inter&outline_colour=262626&coffee_colour=ff0000"
                }
            });
        } catch (e) {
            console.error(e);
            new Notice(
                "There was an error displaying the settings tab for Obsidian Initiative Tracker."
            );
        }
    }

    private _displayBase(containerEl: HTMLDivElement) {
        containerEl.empty();
        new Setting(containerEl).setHeading().setName("Basic Settings");
        new Setting(containerEl)
            .setName("Display Beginner Tips")
            .setDesc(
                "Display instructions in the initiative tracker, helping you get used to the workflow."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.beginnerTips).onChange(
                    async (v) => {
                        this.plugin.data.beginnerTips = v;
                        await this.plugin.saveSettings();
                    }
                );
            });
        new Setting(containerEl)
            .setName("Display Encounter Difficulty")
            .setDesc(
                "Display encounter difficulty based on creature CR and player level. Creatures without CR or level will not be considered in the calculation."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.displayDifficulty).onChange(
                    async (v) => {
                        this.plugin.data.displayDifficulty = v;
                        await this.plugin.saveSettings();
                    }
                );
            });
        new Setting(containerEl)
            .setName("Roll Equivalent Creatures Together")
            .setDesc(
                "Equivalent creatures (same Name and AC) will roll the same initiative by default."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.condense).onChange(async (v) => {
                    this.plugin.data.condense = v;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("Embed statblock-link content in the Creature View")
            .setDesc(
                "Prefer embedded content from a statblock-link attribute when present. Fall back to the TTRPG plugin if the link is missing and the plugin is enabled."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.preferStatblockLink).onChange(
                    async (v) => {
                        this.plugin.data.preferStatblockLink = v;
                        await this.plugin.saveSettings();
                    }
                );
            });
    }
    private async _displayBattle(additionalContainer: HTMLDetailsElement) {
        additionalContainer.empty();
        additionalContainer.ontoggle = () => {
            this.plugin.data.openState.battle = additionalContainer.open;
        };
        const summary = additionalContainer.createEl("summary");
        new Setting(summary).setHeading().setName("Battle");
        summary.createDiv("collapser").createDiv("handle");
        new Setting(additionalContainer)
            .setName("Clamp Minimum HP")
            .setDesc(
                "When a creature takes damage that would reduce its HP below 0, its HP is set to 0 instead."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.clamp).onChange(async (v) => {
                    this.plugin.data.clamp = v;
                    await this.plugin.saveSettings();
                });
            });
        new Setting(additionalContainer)
            .setName("Overflow Healing")
            .setDesc(
                "Set what happens to healing which goes above creatures' max HP threshold."
            )
            .addDropdown((d) => {
                d.addOption("ignore", "Ignore");
                d.addOption("temp", "Add to temp HP");
                d.addOption("current", "Add to current HP");
                d.setValue(this.plugin.data.hpOverflow ?? "ignore");
                d.onChange(async (v) => {
                    this.plugin.data.hpOverflow = v;
                    this.plugin.saveSettings();
                });
            });
        new Setting(additionalContainer)
            .setName("Automatic Unconscious Status Application")
            .setDesc(
                'When a creature takes damage that would reduce its HP below 0, it gains the "Unconscious" status effect.'
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.autoStatus).onChange(async (v) => {
                    this.plugin.data.autoStatus = v;
                    await this.plugin.saveSettings();
                });
            });
        new Setting(additionalContainer)
            .setName("Additive Temporary HP")
            .setDesc(
                "Any temporary HP added to a creature will be added on top of existing temporary HP."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.additiveTemp).onChange(
                    async (v) => {
                        this.plugin.data.additiveTemp = v;
                        await this.plugin.saveSettings();
                    }
                );
            });
        new Setting(additionalContainer)
            .setName("Display Player HP in Player View")
            .setDesc(
                "If turned off, player health will display as 'Healthy', 'Hurt', etc."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.diplayPlayerHPValues).onChange(
                    async (v) => {
                        this.plugin.data.diplayPlayerHPValues = v;
                        await this.plugin.saveSettings();
                    }
                );
            });
        new Setting(additionalContainer)
            .setName("Roll HP for Creatures")
            .setDesc(
                createFragment((e) => {
                    e.createSpan({
                        text: "Creatures added to encounters will automatically roll for HP if the "
                    });
                    e.createEl("code", { text: "hit_dice" });
                    e.createSpan({
                        text: " property is set for the creature."
                    });
                })
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.rollHP).onChange(async (v) => {
                    this.plugin.data.rollHP = v;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(additionalContainer)
            .setName("Log Battles")
            .setDesc(
                "Actions taken during battle will be logged to the specified log folder."
            )
            .addToggle((t) =>
                t.setValue(this.plugin.data.logging).onChange(async (v) => {
                    this.plugin.data.logging = v;
                    await this.plugin.saveSettings();
                })
            );

        const exists = await this.plugin.app.vault.adapter.exists(
            this.plugin.data.logFolder
        );
        new Setting(additionalContainer)
            .setName("Log Folder")
            .setDesc(
                createFragment(async (e) => {
                    e.createSpan({
                        text: "A new note will be created in this folder for each battle."
                    });
                    e.createEl("br");
                    e.createSpan({ text: "Current: " });
                    e.createEl("code", { text: this.plugin.data.logFolder });

                    if (!exists) {
                        e.createEl("br");
                        const container = e.createDiv(
                            "initiative-tracker-warning"
                        );
                        setIcon(container, "initiative-tracker-warning");
                        container.createSpan({
                            text: "This folder does not exist and will be created when a log file is written for the first time."
                        });
                    }
                })
            )
            .addText((t) => {
                t.setValue(this.plugin.data.logFolder);
                let folders = this.app.vault
                    .getAllLoadedFiles()
                    .filter((f) => f instanceof TFolder);
                const modal = new FolderInputSuggest(
                    this.app,
                    t,
                    folders as TFolder[]
                );
                modal.onSelect(async ({ item }) => {
                    this.plugin.data.logFolder = normalizePath(item.path);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
    }
    private _displayPlayers(additionalContainer: HTMLDetailsElement) {
        additionalContainer.empty();
        additionalContainer.ontoggle = () => {
            this.plugin.data.openState.player = additionalContainer.open;
        };
        const summary = additionalContainer.createEl("summary");
        new Setting(summary).setHeading().setName("Players");
        summary.createDiv("collapser").createDiv("handle");
        new Setting(additionalContainer)
            .setName("Add New Player")
            .setDesc(
                "Players added here will be available to add to a party. If you do not have a party created, all players will be added to a new encounter."
            )
            .addButton((button: ButtonComponent): ButtonComponent => {
                let b = button
                    .setTooltip("Add Player")
                    .setButtonText("+")
                    .onClick(async () => {
                        const modal = new NewPlayerModal(this.plugin);
                        modal.open();
                        modal.onClose = async () => {
                            if (!modal.saved) return;

                            await this.plugin.savePlayer({
                                ...modal.player,
                                player: true
                            });

                            this._displayPlayers(additionalContainer);
                        };
                    });

                return b;
            });
        const additional = additionalContainer.createDiv("additional");
        const playerView = additional.createDiv("initiative-tracker-players");
        if (!this.plugin.players.size) {
            additional
                .createDiv({
                    attr: {
                        style: "display: flex; justify-content: center; padding-bottom: 18px;"
                    }
                })
                .createSpan({
                    text: "No saved players! Create one to see it here."
                });
        } else {
            const headers = playerView.createDiv(
                "initiative-tracker-player headers"
            );

            headers.createDiv({ text: "Name" });
            setIcon(
                headers.createDiv({
                    attr: {
                        "aria-label": "Level"
                    }
                }),
                "swords"
            );
            setIcon(
                headers.createDiv({
                    attr: {
                        "aria-label": "Max HP"
                    }
                }),
                HP
            );
            setIcon(
                headers.createDiv({
                    attr: {
                        "aria-label": "Armor Class"
                    }
                }),
                AC
            );
            setIcon(
                headers.createDiv({
                    attr: {
                        "aria-label": "Initiative Modifier"
                    }
                }),
                INITIATIVE
            );
            headers.createDiv();

            for (let player of this.plugin.data.players) {
                const playerDiv = playerView.createDiv(
                    "initiative-tracker-player"
                );
                playerDiv.createDiv({ text: player.name });
                playerDiv.createDiv({
                    text: `${player.level ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.hp ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.ac ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.modifier ?? DEFAULT_UNDEFINED}`
                });
                const icons = playerDiv.createDiv(
                    "initiative-tracker-player-icon"
                );
                new ExtraButtonComponent(icons.createDiv())
                    .setIcon("pencil")
                    .setTooltip("Edit")
                    .onClick(() => {
                        const modal = new NewPlayerModal(this.plugin, player);
                        modal.open();
                        modal.onClose = async () => {
                            if (!modal.saved) return;
                            await this.plugin.updatePlayer(
                                player,
                                modal.player
                            );

                            this._displayPlayers(additionalContainer);
                        };
                    });
                new ExtraButtonComponent(icons.createDiv())
                    .setIcon("trash")
                    .setTooltip("Delete")
                    .onClick(async () => {
                        this.plugin.deletePlayer(player);

                        await this.plugin.saveSettings();
                        this._displayPlayers(additionalContainer);
                    });
            }
            for (let [name, player] of this.plugin.statblock_players) {
                const playerDiv = playerView.createDiv(
                    "initiative-tracker-player"
                );
                playerDiv.createDiv({ text: name });
                playerDiv.createDiv({
                    text: `${player.level ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.hp ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.ac ?? DEFAULT_UNDEFINED}`
                });
                playerDiv.createDiv({
                    text: `${player.modifier ?? DEFAULT_UNDEFINED}`
                });
                const icons = playerDiv.createDiv({
                    cls: "initiative-tracker-player-icon imported",
                    attr: {
                        "aria-label": "Imported from Fantasy Statblocks"
                    }
                });
                setIcon(icons, "heart-handshake");
            }
        }
    }
    private _displayBuilder(additionalContainer: HTMLDetailsElement) {
        additionalContainer.empty();
        additionalContainer.ontoggle = () => {
            this.plugin.data.openState.player = additionalContainer.open;
        };
        const summary = additionalContainer.createEl("summary");
        new Setting(summary).setHeading().setName("Encounters");
        summary.createDiv("collapser").createDiv("handle");
        const explanation = additionalContainer.createDiv(
            "initiative-tracker-explanation"
        );
        explanation.createEl("span", {
            text: "The encounter builder allows you to quickly create encounters that can be saved for later use or immediately launched into a battle."
        });
        explanation.createEl("br");
        explanation.createEl("br");
        explanation.createEl("span", {
            text: "It can be opened using the sidebar shortcut (if enabled) or by using the Open Encounter Builder command."
        });
        new Setting(additionalContainer)
            .setName("Add Sidebar Shortcut")
            .setDesc(
                "A sidebar shortcut will be added to open the Encounter Builder."
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.builder.sidebarIcon).onChange(
                    (v) => {
                        this.plugin.data.builder.sidebarIcon = v;
                        this.plugin.setBuilderIcon();
                    }
                );
            });
        new Setting(additionalContainer)
            .setName("XP System")
            .setDesc("XP system to use for encounters")
            .addDropdown((d) => {
                Object.values(RpgSystemSetting).forEach((system) =>
                    d.addOption(
                        system,
                        getRpgSystem(this.plugin, system).displayName
                    )
                );
                d.setValue(
                    this.plugin.data.rpgSystem ?? RpgSystemSetting.Dnd5e
                );
                d.onChange(async (v) => {
                    this.plugin.data.rpgSystem = v;
                    this.plugin.saveSettings();
                });
            });

        const additional = additionalContainer.createDiv("additional");
        new Setting(additional).setHeading().setName("Saved Encounters");
        if (!Object.keys(this.plugin.data.encounters).length) {
            additional
                .createDiv({
                    attr: {
                        style: "display: flex; justify-content: center; padding-bottom: 18px;"
                    }
                })
                .createSpan({
                    text: "No saved encounters! Create one to see it here."
                });
        } else {
            for (const [name, encounter] of Object.entries(
                this.plugin.data.encounters
            )) {
                new Setting(additional)
                    .setName(name)
                    .setDesc(
                        createFragment((e) => {
                            const players = [],
                                creatures = [];
                            for (const creature of encounter.creatures) {
                                if (creature.player) {
                                    players.push(creature.name);
                                } else {
                                    creatures.push(creature.name);
                                }
                            }

                            if (players.length) {
                                e.createSpan({
                                    text: `Players: ${players.join(", ")}`
                                });
                                e.createEl("br");
                            }
                            if (creatures.length) {
                                e.createSpan({
                                    text: `Creatures: ${creatures.join(", ")}`
                                });
                                e.createEl("br");
                            }

                            if (encounter.timestamp) {
                                e.createSpan({
                                    text: `${new Date(
                                        encounter.timestamp
                                    ).toLocaleString()}`
                                });
                            }
                        })
                    )
                    .addExtraButton((b) => {
                        b.setIcon("trash").onClick(async () => {
                            this.plugin.removeEncounter(name);
                            await this.plugin.saveSettings();
                            this._displayBuilder(additionalContainer);
                        });
                    });
            }
        }
    }
    private _displayParties(additionalContainer: HTMLDetailsElement) {
        additionalContainer.empty();
        additionalContainer.ontoggle = () => {
            this.plugin.data.openState.party = additionalContainer.open;
        };
        const summary = additionalContainer.createEl("summary");
        new Setting(summary).setHeading().setName("Parties");
        summary.createDiv("collapser").createDiv("handle");
        const explanation = additionalContainer.createDiv(
            "initiative-tracker-explanation"
        );
        explanation.createEl("span", {
            text: "Parties allow you to create different groups of your players. Each player can be a member of multiple parties."
        });
        explanation.createEl("br");
        explanation.createEl("br");
        explanation.createEl("span", {
            text: "You can set a default party for encounters to use, or specify the party for the encounter in the encounter block. While running an encounter in the tracker, you can change the active party, allowing you to quickly switch which players are in combat."
        });
        new Setting(additionalContainer)
            .setName("Default Party")
            .setDesc(
                "The tracker will load this party to encounters by default."
            )
            .addDropdown((d) => {
                d.addOption("none", "None");
                for (const party of this.plugin.data.parties) {
                    d.addOption(party.name, party.name);
                }
                d.setValue(this.plugin.data.defaultParty ?? "none");
                d.onChange(async (v) => {
                    this.plugin.data.defaultParty = v == "none" ? null : v;
                    this.plugin.saveSettings();
                });
            });
        new Setting(additionalContainer)
            .setName("Add New Party")
            .addButton((button: ButtonComponent): ButtonComponent => {
                let b = button
                    .setTooltip("Add Party")
                    .setButtonText("+")
                    .onClick(async () => {
                        const modal = new PartyModal(this.plugin);
                        modal.open();
                        modal.onClose = async () => {
                            if (modal.canceled) return;
                            if (!modal.party.name || !modal.party.name.length)
                                return;
                            if (
                                this.plugin.data.parties.filter(
                                    (party) => party.name == modal.party.name
                                )
                            ) {
                                const map = new Map(
                                    [...this.plugin.data.parties].map((c) => [
                                        c.name,
                                        c
                                    ])
                                );
                                map.set(modal.party.name, modal.party);
                                this.plugin.data.parties = Array.from(
                                    map.values()
                                );
                            } else {
                                this.plugin.data.parties.push(modal.party);
                            }

                            await this.plugin.saveSettings();

                            this._displayParties(additionalContainer);
                        };
                    });

                return b;
            });
        const additional = additionalContainer.createDiv("additional");
        if (!this.plugin.data.parties.length) {
            additional
                .createDiv({
                    attr: {
                        style: "display: flex; justify-content: center; padding-bottom: 18px;"
                    }
                })
                .createSpan({
                    text: "No saved parties! Create one to see it here."
                });
        } else {
            for (const party of this.plugin.data.parties) {
                new Setting(additional)
                    .setName(party.name)
                    .setDesc(party.players.join(", "))
                    .addExtraButton((b) => {
                        b.setIcon("pencil").onClick(() => {
                            const modal = new PartyModal(this.plugin, party);
                            modal.open();
                            modal.onClose = async () => {
                                if (modal.canceled) return;
                                if (
                                    !modal.party.name ||
                                    !modal.party.name.length
                                )
                                    return;

                                this.plugin.data.parties.splice(
                                    this.plugin.data.parties.indexOf(party),
                                    1,
                                    modal.party
                                );
                                if (
                                    this.plugin.data.parties.filter(
                                        (s) => s.name == modal.party.name
                                    ).length > 1
                                ) {
                                    if (
                                        this.plugin.data.parties.filter(
                                            (status) =>
                                                status.name == modal.party.name
                                        )
                                    ) {
                                        const map = new Map(
                                            this.plugin.data.parties.map(
                                                (c) => [c.name, c]
                                            )
                                        );
                                        map.set(modal.party.name, modal.party);
                                        this.plugin.data.parties = Array.from(
                                            map.values()
                                        );
                                    }
                                }

                                await this.plugin.saveSettings();

                                this._displayParties(additionalContainer);
                            };
                        });
                    })
                    .addExtraButton((b) => {
                        b.setIcon("trash").onClick(async () => {
                            this.plugin.data.parties =
                                this.plugin.data.parties.filter(
                                    (p) => p.name != party.name
                                );
                            if (this.plugin.data.defaultParty == party.name) {
                                this.plugin.data.defaultParty =
                                    this.plugin.data.parties[0]?.name ?? null;
                            }
                            await this.plugin.saveSettings();
                            this._displayParties(additionalContainer);
                        });
                    });
            }
        }
    }
    private _displayStatuses(additionalContainer: HTMLDetailsElement) {
        additionalContainer.empty();
        additionalContainer.ontoggle = () => {
            this.plugin.data.openState.status = additionalContainer.open;
        };
        const summary = additionalContainer.createEl("summary");
        new Setting(summary).setHeading().setName("Statuses");

        new Setting(additionalContainer)
            .setName("Unconscious Status")
            .setDesc(
                "Choose a different status to be used as the default Unconscious status."
            )
            .addDropdown((d) => {
                for (const status of this.plugin.data.statuses) {
                    d.addOption(status.id, status.name);
                }
                d.setValue(this.plugin.data.unconsciousId);
                d.onChange((id) => (this.plugin.data.unconsciousId = id));
            });
        summary.createDiv("collapser").createDiv("handle");
        const add = new Setting(additionalContainer)
            .setName("Add New Status")
            .setDesc("These statuses will be available to apply to creatures.")
            .addButton((button: ButtonComponent): ButtonComponent => {
                let b = button
                    .setTooltip("Add Status")
                    .setButtonText("+")
                    .onClick(async () => {
                        const modal = new StatusModal(this.plugin);
                        modal.onClose = async () => {
                            if (modal.canceled) return;
                            if (!modal.status.name) return;
                            if (
                                this.plugin.data.statuses.filter(
                                    (status) => status.name == modal.status.name
                                )
                            ) {
                                const map = new Map(
                                    [...this.plugin.data.statuses].map((c) => [
                                        c.name,
                                        c
                                    ])
                                );
                                map.set(modal.status.name, modal.status);
                                this.plugin.data.statuses = Array.from(
                                    map.values()
                                );
                            } else {
                                this.plugin.data.statuses.push(modal.status);
                            }
                            await this.plugin.saveSettings();
                            this._displayStatuses(additionalContainer);
                        };
                        modal.open();
                    });

                return b;
            });
        if (!Conditions.every((c) => this.plugin.data.statuses.includes(c))) {
            add.addExtraButton((b) =>
                b
                    .setIcon("reset")
                    .setTooltip("Re-add Default Statuses")
                    .onClick(async () => {
                        this.plugin.data.statuses = Array.from(
                            new Map(
                                [
                                    ...this.plugin.data.statuses,
                                    ...Conditions
                                ].map((c) => [c.name, c])
                            ).values()
                        );
                        await this.plugin.saveSettings();
                        this._displayStatuses(additionalContainer);
                    })
            );
        }
        const additional = additionalContainer.createDiv("additional");
        for (const status of this.plugin.data.statuses) {
            new Setting(additional)
                .setName(
                    createFragment((e) => {
                        const div = e.createDiv("status-name-container");
                        div.createSpan({ text: status.name });

                        div.createDiv("status-metadata-container");
                        if (status.resetOnRound) {
                            setIcon(
                                div.createDiv({
                                    attr: {
                                        "aria-label": "Reset Each Round"
                                    }
                                }),
                                "timer-reset"
                            );
                        }
                        if (status.hasAmount) {
                            setIcon(
                                div.createDiv({
                                    attr: {
                                        "aria-label": "Has Amount"
                                    }
                                }),
                                "hash"
                            );
                        }
                    })
                )
                .setDesc(status.description ?? "")
                .addExtraButton((b) =>
                    b.setIcon("pencil").onClick(() => {
                        const modal = new StatusModal(this.plugin, status);
                        modal.onClose = async () => {
                            if (modal.canceled) return;
                            if (!modal.status.name) return;
                            this.plugin.data.statuses.splice(
                                this.plugin.data.statuses.indexOf(status),
                                1,
                                modal.status
                            );
                            if (
                                this.plugin.data.statuses.filter(
                                    (s) => s.name == modal.status.name
                                ).length > 1
                            ) {
                                if (
                                    this.plugin.data.statuses.filter(
                                        (status) =>
                                            status.name == modal.status.name
                                    )
                                ) {
                                    const map = new Map(
                                        this.plugin.data.statuses.map((c) => [
                                            c.name,
                                            c
                                        ])
                                    );
                                    map.set(modal.status.name, modal.status);
                                    this.plugin.data.statuses = Array.from(
                                        map.values()
                                    );
                                }
                            }
                            await this.plugin.saveSettings();
                            this._displayStatuses(additionalContainer);
                        };
                        modal.open();
                    })
                )
                .addExtraButton((b) =>
                    b.setIcon("trash").onClick(async () => {
                        this.plugin.data.statuses =
                            this.plugin.data.statuses.filter(
                                (s) => s.name != status.name
                            );
                        if (this.plugin.data.unconsciousId == status.id) {
                            this.plugin.data.unconsciousId = "Unconscious";
                        }
                        await this.plugin.saveSettings();
                        this._displayStatuses(additionalContainer);
                    })
                )
                .setClass("initiative-status-item");
        }
    }
    private async _displayIntegrations(containerEl: HTMLDetailsElement) {
        containerEl.empty();
        containerEl.ontoggle = () => {
            this.plugin.data.openState.plugin = containerEl.open;
        };
        const summary = containerEl.createEl("summary");
        new Setting(summary).setHeading().setName("Plugin Integrations");
        summary.createDiv("collapser").createDiv("handle");
        if (!this.plugin.canUseStatBlocks) {
            this.plugin.data.sync = false;
            await this.plugin.saveSettings();
        }
        new Setting(containerEl)
            .setName("Sync Monsters from TTRPG Statblocks")
            .setDesc(
                createFragment((e) => {
                    e.createSpan({
                        text: "Homebrew creatures saved to the TTRPG Statblocks plugin will be available to use."
                    });
                    if (!this.plugin.canUseStatBlocks) {
                        e.createEl("br");
                        e.createEl("br");
                        e.createSpan({
                            text: "Install and enable the "
                        });
                        e.createEl("a", {
                            text: "TTRPG Statblocks",
                            href: "obsidian://show-plugin?id=obsidian-5e-statblocks"
                        });
                        e.createSpan({
                            text: " plugin to use homebrew creatures."
                        });
                    }
                })
            )
            .addToggle((t) => {
                t.setDisabled(!this.plugin.canUseStatBlocks).setValue(
                    this.plugin.data.sync
                );
                t.onChange(async (v) => {
                    this.plugin.data.sync = v;
                    await this.plugin.saveSettings();
                    this._displayIntegrations(containerEl);
                });
            });
        if (this.plugin.data.sync) {
            const synced = new Setting(containerEl).setDesc(
                `${this.plugin.bestiary.length} creatures synced.`
            );
            synced.settingEl.addClass("initiative-synced");
            setIcon(synced.nameEl, "check-in-circle");
            synced.nameEl.appendChild(createSpan({ text: "Synced" }));
        }

        new Setting(containerEl)
            .setName("Initiative Formula")
            .setDesc(
                createFragment((e) => {
                    e.createSpan({
                        text: "Initiative formula to use when calculating initiative. Use "
                    });
                    e.createEl("code", { text: "%mod%" });
                    e.createSpan({
                        text: " for the modifier placeholder."
                    });
                    if (!this.plugin.canUseDiceRoller) {
                        e.createEl("br");
                        e.createEl("br");
                        e.createSpan({
                            attr: {
                                style: `color: var(--text-error);`
                            },
                            text: "Requires the "
                        });
                        e.createEl("a", {
                            text: "Dice Roller",
                            href: "https://github.com/valentine195/obsidian-dice-roller",
                            cls: "external-link"
                        });
                        e.createSpan({
                            attr: {
                                style: `color: var(--text-error);`
                            },
                            text: " plugin to modify."
                        });
                    }
                })
            )
            .addText((t) => {
                if (!this.plugin.canUseDiceRoller) {
                    t.setDisabled(true);
                    this.plugin.data.initiative = "1d20 + %mod%";
                }
                t.setValue(this.plugin.data.initiative);
                t.onChange((v) => {
                    this.plugin.data.initiative = v;
                });
                t.inputEl.onblur = async () => {
                    tracker.roll(this.plugin);
                    await this.plugin.saveSettings();
                };
            });
    }
}

class NewPlayerModal extends Modal {
    player: HomebrewCreature;
    saved: boolean;
    constructor(
        private plugin: InitiativeTracker,
        private original: HomebrewCreature = {}
    ) {
        super(plugin.app);
        this.player = { ...(original ?? {}) };
    }
    async display(load?: boolean) {
        let { contentEl } = this;

        contentEl.addClass("initiative-tracker-add-player-modal");

        contentEl.empty();

        let error = false;

        contentEl.createEl("h2", {
            text: this.original ? "Edit Player" : "New Player"
        });

        new Setting(contentEl)
            .setName("Link to Note")
            .setDesc("Link player to a note in your vault.")
            .addText((t) => {
                t.setValue(this.player.note ?? "");

                let files = this.app.vault.getFiles();
                const modal = new FileInputSuggest(this.app, t, files);
                modal.onSelect(async ({ item: file }) => {
                    if (!file) return;
                    const metaData = this.app.metadataCache.getFileCache(file);

                    this.player.note = file.basename;
                    this.player.path = file.path;
                    this.player.name = file.basename;

                    if (!metaData || !metaData.frontmatter) return;
                    const { ac, hp, modifier, level, name } =
                        metaData.frontmatter;
                    this.player.name = name ?? this.player.name;
                    this.player.ac = parseInt(ac ?? this.player.ac, 10);
                    this.player.hp = parseInt(hp ?? this.player.hp, 10);
                    this.player.level = parseInt(level ?? this.player.level, 10);
                    this.player.modifier = parseInt(modifier ?? this.player.modifier, 10);
                    this.player["statblock-link"] =
                        metaData.frontmatter["statblock-link"];
                    this.display();
                });
            });

        let nameInput: InputValidate,
            levelInput: InputValidate,
            hpInput: InputValidate,
            modInput: InputValidate;

        new Setting(contentEl)
            .setName("Name")
            .setDesc("Player name. Must be unique!")
            .addText((t) => {
                nameInput = {
                    input: t.inputEl,
                    validate: (i: HTMLInputElement) => {
                        let error = false;
                        if (
                            (!i.value.length && !load) ||
                            (this.plugin.players.has(i.value) &&
                                this.player.name != this.original.name)
                        ) {
                            i.addClass("has-error");
                            error = true;
                        }
                        return error;
                    }
                };
                t.setValue(this.player.name ?? "");
                t.onChange((v) => {
                    t.inputEl.removeClass("has-error");
                    this.player.name = v;
                });
            });
        new Setting(contentEl)
            .setName("Level")
            .setDesc("Player level.")
            .addText((t) => {
                levelInput = {
                    input: t.inputEl,
                    validate: (i: HTMLInputElement) => {
                        let error = false;
                        if (isNaN(Number(i.value)) || Number(i.value) <= 0) {
                            i.addClass("has-error");
                            error = true;
                        }
                        return error;
                    }
                };
                t.setValue(`${this.player.level ?? ""}`);
                t.onChange((v) => {
                    t.inputEl.removeClass("has-error");
                    this.player.level = Number(v);
                });
            });
        new Setting(contentEl).setName("Max Hit Points").addText((t) => {
            hpInput = {
                input: t.inputEl,
                validate: (i: HTMLInputElement) => {
                    let error = false;
                    if (isNaN(Number(i.value))) {
                        i.addClass("has-error");
                        error = true;
                    }
                    return error;
                }
            };
            t.setValue(`${this.player.hp ?? ""}`);
            t.onChange((v) => {
                t.inputEl.removeClass("has-error");
                this.player.hp = Number(v);
            });
        });
        new Setting(contentEl).setName("Armor Class").addText((t) => {
            t.setValue(`${this.player.ac ?? ""}`);
            t.onChange((v) => {
                this.player.ac = v;
            });
        });
        new Setting(contentEl)
            .setName("Initiative Modifier")
            .setDesc("This will be added to randomly-rolled initiatives.")
            .addText((t) => {
                modInput = {
                    input: t.inputEl,
                    validate: (i) => {
                        let error = false;
                        if (isNaN(Number(i.value))) {
                            t.inputEl.addClass("has-error");
                            error = true;
                        }
                        return error;
                    }
                };
                t.setValue(`${this.player.modifier ?? ""}`);
                t.onChange((v) => {
                    this.player.modifier = Number(v);
                });
            });

        let footerEl = contentEl.createDiv();
        let footerButtons = new Setting(footerEl);
        footerButtons.addButton((b) => {
            b.setTooltip("Save")
                .setIcon("checkmark")
                .onClick(async () => {
                    let error = this.validateInputs(
                        nameInput,
                        hpInput,
                        modInput
                    );
                    if (error) {
                        new Notice("Fix errors before saving.");
                        return;
                    }
                    this.saved = true;
                    this.close();
                });
            return b;
        });
        footerButtons.addExtraButton((b) => {
            b.setIcon("cross")
                .setTooltip("Cancel")
                .onClick(() => {
                    this.saved = false;
                    this.close();
                });
            return b;
        });

        this.validateInputs(nameInput, hpInput, modInput);
    }
    validateInputs(...inputs: InputValidate[]) {
        let error = false;
        for (let input of inputs) {
            if (input.validate(input.input)) {
                error = true;
            } else {
                input.input.removeClass("has-error");
            }
        }
        return error;
    }
    onOpen() {
        this.display(true);
    }
}

import { App, ButtonComponent, Modal } from "obsidian";
import { tracker } from "src/tracker/stores/tracker";
import { getId } from "src/utils/creature";

export async function confirmWithModal(
    app: App,
    text: string,
    buttons: { cta: string; secondary: string } = {
        cta: "Yes",
        secondary: "No"
    }
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const modal = new ConfirmModal(app, text, buttons);
        modal.onClose = () => {
            resolve(modal.confirmed);
        };
        modal.open();
    });
}

export class ConfirmModal extends Modal {
    constructor(
        app: App,
        public text: string,
        public buttons: { cta: string; secondary: string }
    ) {
        super(app);
    }
    confirmed: boolean = false;
    async display() {
        new Promise((resolve) => {
            this.contentEl.empty();
            this.contentEl.addClass("confirm-modal");
            this.contentEl.createEl("p", {
                text: this.text
            });
            const buttonEl = this.contentEl.createDiv(
                "fantasy-calendar-confirm-buttons"
            );
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.cta)
                .setCta()
                .onClick(() => {
                    this.confirmed = true;
                    this.close();
                });
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.secondary)
                .onClick(() => {
                    this.close();
                });
        });
    }
    onOpen() {
        this.display();
    }
}
addIcon(
    "initiative-tracker-warning",
    `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="exclamation-triangle" class="svg-inline--fa fa-exclamation-triangle fa-w-18" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"></path></svg>`
);

class StatusModal extends Modal {
    status: Condition = { name: null, description: null, id: getId() };
    canceled = false;
    editing: boolean = false;
    original: string;
    constructor(public plugin: InitiativeTracker, status?: Condition) {
        super(plugin.app);
        if (status) {
            this.editing = true;
            this.original = status.name;
            this.status = {
                name: status.name,
                description: status.description,
                id: status.id ?? getId()
            };
        }
    }
    warned = false;
    onOpen() {
        this.titleEl.setText(this.editing ? "Edit Status" : "New Status");
        this.contentEl.empty();
        const name = new Setting(this.contentEl)
            .setName("Name")
            .addText((t) => {
                t.setValue(this.status.name).onChange((v) => {
                    this.status.name = v;
                    if (
                        this.plugin.data.statuses.find(
                            (s) => s.name == this.status.name
                        ) &&
                        !this.warned &&
                        this.original != this.status.name
                    ) {
                        this.warned = true;
                        name.setDesc(
                            createFragment((e) => {
                                const container = e.createDiv(
                                    "initiative-tracker-warning"
                                );
                                setIcon(
                                    container,
                                    "initiative-tracker-warning"
                                );
                                container.createSpan({
                                    text: "A status by this name already exists and will be overwritten."
                                });
                            })
                        );
                    } else if (this.warned) {
                        this.warned = false;
                        name.setDesc("");
                    }
                });
            });
        new Setting(this.contentEl).setName("Description").addTextArea((t) => {
            t.setValue(this.status.description).onChange(
                (v) => (this.status.description = v)
            );
        });
        new Setting(this.contentEl)
            .setName("Remove Each Round")
            .setDesc(
                "This status will be removed from all creatures at the start of a new round."
            )
            .addToggle((t) =>
                t
                    .setValue(this.status.resetOnRound)
                    .onChange((v) => (this.status.resetOnRound = v))
            );
        new Setting(this.contentEl)
            .setName("Has Amount")
            .setDesc(
                "This status has an amount that can be increased or decreased during combat."
            )
            .addToggle((t) =>
                t.setValue(this.status.hasAmount).onChange((v) => {
                    this.status.hasAmount = v;
                    this.onOpen();
                })
            );
        if (this.status.hasAmount) {
            new Setting(this.contentEl)
                .setName("Starting Amount")
                .setDesc("The status will default to this amount when added.")
                .addText(
                    (t) =>
                        (t
                            .setValue(`${this.status.startingAmount}`)
                            .onChange((v) => {
                                this.status.amount =
                                    this.status.startingAmount = Number(v);
                            }).inputEl.type = "number")
                );
        }

        new ButtonComponent(
            this.contentEl.createDiv("initiative-tracker-cancel")
        )
            .setButtonText("Cancel")
            .onClick(() => {
                this.canceled = true;
                this.close();
            });
    }
}

class PartyModal extends Modal {
    party: Party = { name: null, players: [] };
    canceled = false;
    editing = false;
    warned = false;
    original: string;
    constructor(public plugin: InitiativeTracker, party?: Party) {
        super(plugin.app);
        if (party) {
            this.editing = true;
            this.original = party.name;
            this.party = {
                name: party.name,
                players: [...(party.players ?? [])]
            };
        }
    }
    onOpen(): void {
        this.titleEl.setText(
            this.editing ? `Edit ${this.party.name ?? "Party"}` : "New Party"
        );

        const name = new Setting(this.contentEl)
            .setName("Name")
            .addText((t) => {
                t.setValue(this.party.name).onChange((v) => {
                    this.party.name = v;
                    if (
                        this.plugin.data.parties.find(
                            (s) => s.name == this.party.name
                        ) &&
                        !this.warned &&
                        this.original != this.party.name
                    ) {
                        this.warned = true;
                        name.setDesc(
                            createFragment((e) => {
                                const container = e.createDiv(
                                    "initiative-tracker-warning"
                                );
                                setIcon(
                                    container,
                                    "initiative-tracker-warning"
                                );
                                container.createSpan({
                                    text: "A party by this name already exists and will be overwritten."
                                });
                            })
                        );
                    } else if (this.warned) {
                        this.warned = false;
                        name.setDesc("");
                    }
                });
            });

        const playersEl = this.contentEl.createDiv(
            "initiative-tracker-additional-container"
        );
        let playerText: TextComponent;
        new Setting(playersEl)
            .setName("Add Player to Party")
            .addText((t) => {
                playerText = t;
                const modal = new PlayerSuggestionModal(this.plugin.app, t, [
                    ...this.plugin.players.values()
                ]).onSelect(({ item }) => {
                    t.setValue(item.name);
                    modal.close();
                });
            })
            .addExtraButton((b) =>
                b.setIcon("plus-with-circle").onClick(() => {
                    if (!playerText.getValue() || !playerText.getValue().length)
                        return;
                    if (this.party.players.includes(playerText.getValue())) {
                        new Notice("That player is already in this party!");
                        return;
                    }
                    if (!this.plugin.players.has(playerText.getValue())) {
                        new Notice(
                            "That player doesn't exist! You should make them first."
                        );
                        return;
                    }
                    this.party.players.push(playerText.getValue());
                    this.displayPlayers(playersDisplayEl);
                    playerText.setValue("");
                })
            );
        const playersDisplayEl = playersEl.createDiv("additional");
        this.displayPlayers(playersDisplayEl);

        new ButtonComponent(
            this.contentEl.createDiv("initiative-tracker-cancel")
        )
            .setButtonText("Cancel")
            .onClick(() => {
                this.canceled = true;
                this.close();
            });
    }
    displayPlayers(containerEl: HTMLDivElement) {
        containerEl.empty();
        if (this.party.players.length) {
            for (const player of this.party.players) {
                new Setting(containerEl).setName(player).addExtraButton((b) => {
                    b.setIcon("trash").onClick(() => {
                        this.party.players.splice(
                            this.party.players.indexOf(player),
                            1
                        );
                        this.displayPlayers(containerEl);
                    });
                });
            }
        } else {
            containerEl
                .createDiv({
                    attr: {
                        style: "display: flex; justify-content: center; padding-bottom: 18px;"
                    }
                })
                .createSpan({
                    text: "Add a player to the party to see it here."
                });
        }
    }
}
