<script lang="ts">
    import { DEFAULT_UNDEFINED, FRIENDLY, HIDDEN } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import Initiative from "./Initiative.svelte";
    import CreatureControls from "./CreatureControls.svelte";
    import Status from "./Status.svelte";
    import { Platform, setIcon } from "obsidian";
    import { tracker } from "../../stores/tracker";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    const { updateTarget } = tracker;

    export let creature: Creature;
    $: statuses = creature.status;

    const name = () => creature.getName();
    const statblockLink = () => creature.getStatblockLink();
    const hiddenIcon = (div: HTMLElement) => {
        setIcon(div, HIDDEN);
    };
    const friendlyIcon = (div: HTMLElement) => {
        setIcon(div, FRIENDLY);
    };

    let hoverTimeout: NodeJS.Timeout = null;
    const tryHover = (evt: MouseEvent) => {
        hoverTimeout = setTimeout(() => {
            if (creature["statblock-link"]) {
                let link = statblockLink();
                if (/\[.+\]\(.+\)/.test(link)) {
                    //md
                    [, link] = link.match(/\[.+?\]\((.+?)\)/);
                } else if (/\[\[.+\]\]/.test(link)) {
                    //wiki
                    [, link] = link.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
                }

                app.workspace.trigger(
                    "link-hover",
                    {}, //hover popover, but don't need
                    evt.target, //targetEl
                    link, //linkText
                    "initiative-tracker " //source
                );
            }
        }, 1000);
    };

    const cancelHover = (evt: MouseEvent) => {
        clearTimeout(hoverTimeout);
    };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<td class="initiative-container" on:click={(e) => e.stopPropagation()}>
    <Initiative
        initiative={creature.initiative}
        modifier={[creature.modifier].flat().reduce((a, b) => a + b, 0)}
        on:click={(e) => e.stopPropagation()}
        on:initiative={(e) => {
            tracker.updateCreatures({
                creature,
                change: { initiative: Number(e.detail) }
            });
        }}
    />
</td>
<td class="name-container">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        class="name-holder"
        on:click|stopPropagation={(evt) => {
            dispatch("open-combatant", creature);
        }}
        on:mouseenter={tryHover}
        on:mouseleave={cancelHover}
    >
        {#if creature.hidden}
            <div class="centered-icon" use:hiddenIcon />
        {/if}
        {#if creature.friendly}
            <div class="centered-icon" use:friendlyIcon />
        {/if}
        {#if creature.player}
            <strong class="name player">{creature.name}</strong>
        {:else}
            <span class="name">{name()}</span>
        {/if}
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="statuses" on:click={(e) => e.stopPropagation()}>
        {#if statuses.size}
            {#each [...statuses] as status}
                <Status
                    {status}
                    on:remove={() => {
                        tracker.updateCreatures({
                            creature,
                            change: { remove_status: [status] }
                        });
                    }}
                />
            {/each}
        {/if}
    </div>
</td>

<td
    class="center hp-container creature-adder"
    class:mobile={Platform.isMobile}
    on:click|stopPropagation={(evt) => {
        const prev = $updateTarget;
        $updateTarget = "hp";
        if (prev == "ac") return;
        tracker.setUpdate(creature, evt);
    }}
>
    <div>
        {@html creature.hpDisplay}
    </div>
</td>

<td
    class="center ac-container creature-adder"
    class:mobile={Platform.isMobile}
    on:click|stopPropagation={(evt) => {
        const prev = $updateTarget;
        $updateTarget = "ac";
        if (prev == "hp") return;
        tracker.setUpdate(creature, evt);
    }}
>
    <div
        class:dirty-ac={creature.current_ac != creature.ac}
        aria-label={creature.current_ac != creature.ac ? `${creature.ac}` : ""}
    >
        {creature.current_ac ? creature.current_ac : DEFAULT_UNDEFINED}
    </div>
</td>

<td class="controls-container">
    <CreatureControls
        on:click={(e) => e.stopPropagation()}
        on:tag
        on:edit
        on:hp
        {creature}
    />
</td>

<style scoped>
    .name-holder {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: small;
    }
    .centered-icon {
        display: flex;
        align-items: center;
    }
    .name {
        display: block;
        text-align: left;
        background-color: inherit;
        border: 0;
        padding: 0;
        height: unset;
        word-break: keep-all;
    }
    .center {
        text-align: center;
    }
    .creature-adder {
        cursor: pointer;
    }

    .statuses {
        display: flex;
        flex-flow: row wrap;
        column-gap: 0.25rem;
    }

    .initiative-container {
        border-top-left-radius: 0.25rem;
        border-bottom-left-radius: 0.25rem;
    }
    .controls-container {
        border-top-right-radius: 0.25rem;
        border-bottom-right-radius: 0.25rem;
    }
    .dirty-ac {
        font-weight: var(--font-bold);
    }
    .mobile {
        font-size: smaller;
    }
</style>
