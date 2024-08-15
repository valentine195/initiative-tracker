<script lang="ts">
    import { ExtraButtonComponent, TextComponent, setIcon } from "obsidian";
    import type InitiativeTracker from "src/main";
    import { AC, HP, REMOVE, TAG } from "src/utils";
    import { ConditionSuggestionModal } from "src/utils/suggester";
    import { getContext } from "svelte";
    import { getId } from "src/utils/creature";
    import Status from "src/tracker/ui/creatures/Status.svelte";

    import { tracker } from "../stores/tracker";
    const { updating, updateTarget } = tracker;
    import { writable } from "svelte/store";
    import type { Condition } from "src/types/creatures";

    const plugin = getContext<InitiativeTracker>("plugin");
    const hpIcon = (node: HTMLElement) => {
        setIcon(node, HP);
    };
    const acIcon = (node: HTMLElement) => {
        setIcon(node, AC);
    };
    const tagIcon = (node: HTMLElement) => {
        setIcon(node, TAG);
    };
    let statusBtn: ExtraButtonComponent;
    const addStatusIcon = (node: HTMLElement) => {
        statusBtn = new ExtraButtonComponent(node).setIcon("plus-circle");
    };
    const removeIcon = (node: HTMLElement) => {
        setIcon(node, REMOVE);
    };
    const checkIcon = (node: HTMLElement) => {
        setIcon(node, "check");
    };
    const cancelIcon = (node: HTMLElement) => {
        setIcon(node, "cross-in-box");
    };
    let damage: string = "";
    let ac: string = "";
    let status: string = null;
    $: {
        if (statusBtn) statusBtn.setDisabled(!status);
    }
    const statuses = writable<Condition[]>([]);
    const addStatus = () => {
        if (status) {
            $statuses = [
                ...$statuses,
                {
                    ...(plugin.data.statuses.find((s) => s.name == status) ?? {
                        name: status,
                        id: getId(),
                        description: ""
                    })
                }
            ];
            status = null;
            modal.items = plugin.data.statuses
                .filter((s) => !$statuses.find((a) => a.id == s.id))
                .map((s) => s.name);
            conditionText.setValue("");
        }
    };

    let modal: ConditionSuggestionModal;
    let conditionText: TextComponent;
    const conditionDiv = (node: HTMLElement) => {
        conditionText = new TextComponent(node);
        conditionText.onChange((v) => (status = v));
        node.onkeydown = (evt) => {
            if (evt.key === "Enter") {
                status ? addStatus() : performUpdate(true);
        }};
        createModal();
    };
    const createModal = () => {
        modal = new ConditionSuggestionModal(
            plugin.app,
            conditionText,
            plugin.data.statuses
                .filter((s) => !$statuses.find((a) => a.id == s.id))
                .map((s) => s.name)
        );
        modal.onSelect(async ({ item }) => {
            status = item;
            conditionText.setValue(item);

            modal.close();
            addStatus();
        });
    };
    function init(el: HTMLInputElement, target: "hp" | "ac") {
        if ($updateTarget == target) el.focus();
    }
    const performUpdate = (perform: boolean) => {
        if (perform) {
            tracker.doUpdate(damage ?? "", $statuses, ac);
        } else {
            tracker.clearUpdate();
        }

        damage = null;
        status = null;
        ac = null;
        $statuses = [];
        modal = null;

        $updateTarget = null;

        return;
    };
</script>

{#if $updating.size}
    <div class="updating-container">
        {#if $updateTarget == "hp"}
            <div class="updating-hp">
                <!-- svelte-ignore a11y-autofocus -->
                <div class="hp-status">
                    {#if plugin.data.beginnerTips}
                        <small class="label">
                            Apply damage, (-)healing, (t)temp HP, or (m)max HP
                        </small>
                    {/if}
                    <div class="input">
                        <tag
                            use:hpIcon
                            aria-label="Apply damage, (-)healing, (t)temp HP, or (m)max HP"
                            style="margin: 0 0.2rem 0 0.7rem"
                        />
                        <input
                            type="text"
                            bind:value={damage}
                            on:keydown={function (evt) {
                                if (evt.key == "Tab") {
                                    return true;
                                }
                                if (evt.key == "Enter" || evt.key == "Escape") {
                                    performUpdate(evt.key == "Enter");
                                    return;
                                }
                                if (
                                    !/^((t|m)?-?\d*\.?\d*(Backspace|Delete|Arrow\w+)?)$/.test(
                                        this.value + evt.key
                                    )
                                ) {
                                    evt.preventDefault();
                                    return false;
                                }
                            }}
                            use:init={"hp"}
                        />
                    </div>
                </div>
                <div class="hp-status">
                    {#if plugin.data.beginnerTips}
                        <small class="label">
                            Apply status effect to creatures that fail their
                            saving throw
                        </small>
                    {/if}
                    <div class="input-status">
                        <div class="input">
                            <div
                                use:tagIcon
                                aria-label="Apply status effect to creatures that fail their saving throw"
                                style="margin: 0 0.2rem 0 0.7rem"
                            />
                            <div use:conditionDiv />
                        </div>
                        <div
                            use:addStatusIcon
                            aria-label="Add Status"
                            on:click={addStatus}
                            style="margin: 0rem 0.2rem 0rem 0rem"
                        />
                    </div>
                    {#if $statuses.length}
                        <div class="status-list">
                            <div
                                use:removeIcon
                                aria-label="Clear status list"
                                style="margin:0.2rem 0.2rem 0rem 0.7rem;cursor:pointer;"
                                on:click={function (evt) {
                                    $statuses = [];
                                }}
                            />
                            <div class="status-list-entries">
                                {#each $statuses as status}
                                    <Status
                                        {status}
                                        on:remove={function (evt) {
                                            $statuses.remove(status);
                                            $statuses = $statuses;
                                        }}
                                    />
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {:else}
            <div class="hp-status">
                {#if plugin.data.beginnerTips}
                    <small class="label"> Set AC </small>
                {/if}
                <div class="input">
                    <tag
                        use:acIcon
                        aria-label="Set or (+/-)modify the AC of creatures"
                        style="margin: 0 0.2rem 0 0.7rem"
                    />
                    <input
                        type="text"
                        bind:value={ac}
                        on:focus={function () {
                            // Resolves bug caused by condition select modal not closing
                            modal = null;
                        }}
                        on:keydown={function (evt) {
                            if (evt.key == "Tab") {
                                return true;
                            }
                            if (evt.key == "Enter" || evt.key == "Escape") {
                                performUpdate(evt.key == "Enter");
                                return;
                            }
                        }}
                        use:init={"ac"}
                    />
                </div>
            </div>
        {/if}
    </div>
    <div style="margin: 0.5rem">
        <table class="updating-creature-table">
            <thead class="updating-creature-table-header">
                <th style="width:100%" class="left">Name</th>
                {#if $updateTarget == "hp"}
                    <th style="padding:0 0.2rem" class="center">Saved</th>
                    <th style="padding:0 0.2rem" class="center">Resist</th>
                    <th style="padding:0 0.2rem" class="center">Modifier</th>
                    <th />
                {/if}
            </thead>
            <tbody>
                {#each [...$updating.entries()] as [creature, update], i}
                    <tr class="updating-creature-table-row">
                        <td>
                            <span>
                                {creature.name +
                                    (creature.number
                                        ? " " + creature.number
                                        : "")}
                            </span>
                        </td>
                        {#if $updateTarget == "hp"}
                            <td class="center">
                                <input
                                    type="checkbox"
                                    checked={update.saved}
                                    on:click={function (evt) {
                                        update.saved = !update.saved;
                                    }}
                                />
                            </td>
                            <td class="center">
                                <input
                                    type="checkbox"
                                    checked={update.resist}
                                    on:click={function (evt) {
                                        update.resist = !update.resist;
                                    }}
                                />
                            </td>
                            <td class="center">
                                <input
                                    type="number"
                                    class="center"
                                    style="width:90%; height:80%; padding:0;"
                                    bind:value={update.customMod}
                                    on:keydown={function (evt) {
                                        if (evt.key === "Escape") {
                                            this.value = "1";
                                            return;
                                        }
                                        if (evt.key === "Enter") {
                                            evt.preventDefault();
                                            return;
                                        }
                                    }}
                                />
                            </td>
                        {/if}
                        <td
                            use:removeIcon
                            on:click={function (evt) {
                                tracker.setUpdate(creature, evt);
                                if (!$updating.size) {
                                    $statuses = [];
                                    modal = null;
                                }
                            }}
                            style="cursor:pointer"
                        />
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    <div class="updating-buttons">
        <span
            use:checkIcon
            on:click={() => performUpdate(true)}
            style="cursor:pointer"
            aria-label="Apply"
        />
        <span
            use:cancelIcon
            on:click={() => performUpdate(false)}
            style="cursor:pointer"
            aria-label="Cancel"
        />
    </div>
{:else}
    <div on:load={() => performUpdate(false)} />
{/if}

<style scoped>
    .input {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    :global(.is-disabled) {
        cursor: not-allowed;
    }
    .input-status {
        display: flex;
        justify-content: space-between;
    }
    .input > div,
    .input-status > div,
    td:has(> svg),
    th:has(> svg) {
        display: flex;
        align-items: center;
    }
    .status-list {
        display: flex;
        margin: 0.5rem 0 0.1rem 0;
    }
    .status-list-entries {
        display: flex;
        flex-flow: row wrap;
        column-gap: 0.25rem;
        margin: 0 2rem 0 0.5rem;
    }
    .left {
        text-align: left;
    }
    .center {
        text-align: center;
    }
    .updating-hp {
        display: flex;
        flex-flow: column;
        gap: 0.5rem;
    }
    .updating-container {
        display: flex;
        flex-flow: column nowrap;
        gap: 0.5rem;
    }
    .hp-status {
        display: flex;
        flex-flow: column;
    }
    .updating-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-right: 0.7rem;
    }
    td > input {
        margin: 0;
    }
</style>
