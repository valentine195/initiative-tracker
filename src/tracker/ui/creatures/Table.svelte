<script lang="ts">
    import { ExtraButtonComponent, setIcon } from "obsidian";

    import CreatureTemplate from "./Creature.svelte";

    import { AC, DICE, HP, LOCK, UNLOCK } from "src/utils";
    import { Creature, getId } from "src/utils/creature";
    import { createEventDispatcher } from "svelte";
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    import { tracker } from "../../stores/tracker";
    import type InitiativeTracker from "src/main";
    import { getContext } from "svelte";

    const plugin = getContext<InitiativeTracker>("plugin");
    const { state, ordered, dragEnabled } = tracker;

    $: items = [...$ordered].map((c) => {
        return { creature: c, id: getId() };
    });

    const dispatch = createEventDispatcher();

    const hpIcon = (node: HTMLElement) => {
        setIcon(node, HP);
    };
    const acIcon = (node: HTMLElement) => {
        setIcon(node, AC);
    };
    const flipDurationMs = 300;
    function handleDndConsider(
        e: CustomEvent<GenericDndEvent<{ creature: Creature; id: string }[]>>
    ) {
        items = e.detail.items;
    }
    function handleDndFinalize(
        e: CustomEvent<GenericDndEvent<{ creature: Creature; id: string }[]>>
    ) {
        if (e.detail.items.length > 1) {
            let dropped = e.detail.items.find(
                ({ id }) => id == e.detail.info.id
            );
            const index = e.detail.items.findIndex(
                (c) => c.id == e.detail.info.id
            );
            if (index == e.detail.items.length - 1) {
                dropped.creature.initiative =
                    e.detail.items[index - 1].creature.initiative;
            } else {
                dropped.creature.initiative =
                    e.detail.items[index + 1].creature.initiative;
            }
            tracker.logNewInitiative(dropped.creature);
        }
        items = e.detail.items;
        $tracker = [...items.map(({ creature }) => creature)];
    }

    const diceIcon = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(DICE);
    };

    const lockIcon = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(LOCK);
    };

    const unlockIcon = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(UNLOCK);
    };
</script>

<table class="initiative-tracker-table">
    {#if $ordered.length}
        <thead class="tracker-table-header">
            {#if $dragEnabled}
                <td
                    style="width: 10%;"
                    use:unlockIcon
                    aria-label="Lock Drag & Drop"
                    on:click={() => ($dragEnabled = false)}
                />
            {:else}
                <td
                    style="width: 10%;"
                    use:lockIcon
                    aria-label="Unlock Drag & Drop"
                    on:click={() => ($dragEnabled = true)}
                />
            {/if}
            <td
                style="width: 10%;"
                use:diceIcon
                aria-label="Re-Roll Initiatives"
                on:click={(evt) => tracker.roll(plugin)}
            />
            <th class="left" style="width:55%">Name</th>
            <th style="width:15%" use:hpIcon class="center" />
            <th style="width:15%" use:acIcon class="center" />
            <th style="width:5%" />
        </thead>
        <tbody
            use:dndzone={{
                items,
                flipDurationMs,
                dropTargetStyle: {},
                morphDisabled: true,
                dragDisabled: !$dragEnabled
            }}
            on:consider={handleDndConsider}
            on:finalize={handleDndFinalize}
        >
            {#each items as { creature, id } (id)}
                <tr
                    class="draggable initiative-tracker-creature"
                    class:disabled={!creature.enabled}
                    class:active={$state && creature.active}
                    class:viewing={creature.viewing}
                    class:friendly={creature.friendly}
                    animate:flip={{ duration: flipDurationMs }}
                    data-hp={creature.hp}
                    data-hp-max={creature.current_max}
                    data-hp-percent={Math.round(
                        ((creature.hp ?? 0) / creature.max) * 100
                    )}
                    on:click={(e) => {
                        dispatch("open-combatant", creature);
                        e.stopPropagation();
                    }}
                >
                    <CreatureTemplate
                        {creature}
                        on:hp
                        on:tag
                        on:edit
                        on:open-combatant
                    />
                </tr>
            {/each}
        </tbody>
    {:else}
        <div class="no-creatures">
            <p>Add a creature to get started!</p>
            <small>Players may be created in settings.</small>
        </div>
    {/if}
</table>

<style scoped>
    .no-creatures {
        margin: 1rem;
        text-align: center;
    }
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0 2px;
    }

    .left {
        text-align: left;
    }
    .center {
        text-align: center;
    }

    .tracker-table-header {
        font-weight: bolder;
        display: contents;
    }

    .initiative-tracker-creature {
        position: relative;
    }
    .initiative-tracker-creature.active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .initiative-tracker-creature.active {
        background-color: rgba(255, 255, 255, 0.1);
    }
    .initiative-tracker-creature.disabled :global(*) {
        color: var(--text-faint);
    }
    .initiative-tracker-creature :global(td) {
        border-top: 1px solid transparent;
        border-bottom: 1px solid transparent;
    }
    .initiative-tracker-creature :global(td:first-child) {
        border-left: 1px solid transparent;
    }
    .initiative-tracker-creature :global(td:last-child) {
        border-right: 1px solid transparent;
    }
    .initiative-tracker-creature:hover :global(td),
    .initiative-tracker-creature.viewing :global(td) {
        border-top: 1px solid var(--background-modifier-border);
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .initiative-tracker-creature:hover :global(td:first-child),
    .initiative-tracker-creature.viewing :global(td:first-child) {
        border-left: 1px solid var(--background-modifier-border);
    }
    .initiative-tracker-creature:hover :global(td:last-child),
    .initiative-tracker-creature.viewing :global(td:last-child) {
        border-right: 1px solid var(--background-modifier-border);
    }
</style>
