<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone } from "svelte-dnd-action";
    import { NAME_HEADER, TableHeader } from "./table";
    import { ButtonComponent, Setting, setIcon } from "obsidian";
    import { createEventDispatcher } from "svelte";
    import { SORT_NUMBER, SORT_STRING } from "src/utils";
    import { EditModal } from "./edit-modal";
    import { getId } from "src/utils/creature";
    import {
        SortFunctions,
        type TableHeaderState
    } from "src/builder/builder.types";

    const dispatch = createEventDispatcher<{
        update: TableHeaderState[];
        cancel: null;
        reset: null;
    }>();

    export let headers: TableHeaderState[];
    type DraggableHeader = { id: string; header: TableHeaderState };
    let items: DraggableHeader[] = [];
    for (const header of headers) {
        items.push({ id: getId(), header });
    }
    const flipDurationMs = 300;
    function handleDndConsider(e: CustomEvent<{ items: DraggableHeader[] }>) {
        items = e.detail.items;
    }
    function handleDndFinalize(e: CustomEvent<{ items: DraggableHeader[] }>) {
        items = e.detail.items;
    }

    $: dispatch(
        "update",
        items.reduce((a, b) => {
            a.push(b.header);
            return a;
        }, [])
    );

    const openModal = async (header?: TableHeaderState) => {
        const modal = new EditModal(app);
        modal.header = header ?? TableHeader.defaultState;
        if (header) modal.editing = true;
        modal.open();
        return new Promise<TableHeaderState | void>((resolve) => {
            modal.onClose = () => {
                if (modal.canceled) {
                    resolve();
                } else {
                    resolve(modal.header);
                }
            };
        });
    };

    const icon = (type: SortFunctions) => {
        switch (type) {
            case SortFunctions.LOCAL_COMPARE:
            case SortFunctions.PF2_TRAIT:
            case SortFunctions.PF2_TYPE:
                return SORT_STRING;
            case SortFunctions.CONVERT_FRACTION:
            case SortFunctions.PF2_LEVEL:
                return SORT_NUMBER;
            case SortFunctions.CUSTOM:
                return "function-square";
        }
    };

    const headerSettingName = (node: HTMLElement) => {
        new Setting(node)
            .setName(
                createFragment((e) => {
                    const desc = e.createDiv("header-desc");
                    setIcon(desc.createDiv(), icon(NAME_HEADER.type));
                    desc.createSpan({ text: NAME_HEADER.text });
                })
            )
            .setDesc(
                createFragment((e) => {
                    e.createEl("em", { text: NAME_HEADER.field });
                })
            );
    };
    const headerSetting = (node: HTMLElement, draggable: DraggableHeader) => {
        const { header, id } = draggable;
        new Setting(node)
            .setName(
                createFragment((e) => {
                    const desc = e.createDiv("header-desc");
                    setIcon(desc.createDiv(), icon(header.type));
                    desc.createSpan({ text: header.text });
                })
            )
            .setDesc(
                createFragment((e) => {
                    e.createEl("em", { text: header.field });
                })
            )
            .addExtraButton((b) => {
                b.setIcon("edit").onClick(async () => {
                    const state = await openModal(header);
                    if (
                        state &&
                        state.text?.length &&
                        state.field?.length &&
                        (state.type != SortFunctions.CUSTOM ||
                            state?.func?.length)
                    ) {
                        items.splice(
                            items.findIndex((i) => i.id == id),
                            1,
                            { id: getId(), header: state }
                        );
                        items = items;
                    }
                });
            })
            .addExtraButton((b) =>
                b.setIcon("trash").onClick(() => {
                    items = items.filter((i) => i.id != id);
                })
            );
    };
    const add = (node: HTMLElement) => {
        new Setting(node).setName("Add Header").addExtraButton((b) =>
            b.setIcon("plus-circle").onClick(async () => {
                const state = await openModal();
                if (
                    state &&
                    state.text?.length &&
                    state.field?.length &&
                    (state.type != SortFunctions.CUSTOM || state?.func?.length)
                ) {
                    items.push({
                        id: getId(),
                        header: state
                    });
                    items = items;
                }
            })
        );
    };
    const reset = (node: HTMLElement) => {
        new Setting(node)
            .setName("Reset Headers")
            .setDesc("Reset table headers to defaults.")
            .addExtraButton((b) =>
                b.setIcon("reset").onClick(() => {
                    dispatch("reset");
                })
            );
    };
    const cancel = (node: HTMLElement) => {
        new ButtonComponent(node).setButtonText("Cancel").setCta();
    };
</script>

<div use:reset />

<div use:add />

<p>
    <small>
        Organize your headers here. Headers can be drag-and-dropped!
    </small>
</p>
<div class="header-container">
    <div use:headerSettingName class="header" />
    <section
        use:dndzone={{ items, flipDurationMs }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
    >
        {#each items as item (item.id)}
            <div animate:flip={{ duration: flipDurationMs }}>
                <div use:headerSetting={item} class="header" />
            </div>
        {/each}
    </section>
</div>

<div class="cancel-button">
    <div use:cancel on:click={() => dispatch("cancel")} />
</div>

<style scoped>
    .header-container {
        margin: 0 0.5rem;
    }
    /* .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    } */
    .header :global(.header-desc) {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    .header :global(.header-desc *:has(svg)) {
        display: flex;
        align-items: center;
    }
    .cancel-button {
        display: flex;
        justify-content: flex-end;
    }
</style>
