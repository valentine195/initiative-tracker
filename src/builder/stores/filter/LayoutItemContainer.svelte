<script lang="ts">
    import { ExtraButtonComponent, setIcon } from "obsidian";
    import {
        type BuiltFilterStore,
        type Filter,
        FilterType
    } from "src/builder/stores/filter/filter";
    import { createEventDispatcher, getContext } from "svelte";
    import { EditFilterModal } from "./filters-modal";

    const dispatch = createEventDispatcher<{
        edit: null;
        deleted: string;
    }>();

    const filterStore = getContext<BuiltFilterStore>("filterStore");
    const { filters } = filterStore;

    export let id: string;

    let filter = $filters.get(id).filter;
    const getIcon = (node: HTMLElement) => {
        switch (filter.type) {
            case FilterType.Range:
                return setIcon(node, "sliders-horizontal");
            case FilterType.Search:
                return setIcon(node, "search");
            case FilterType.Options:
                return setIcon(node, "list");
            case FilterType.PF2_Level_Range:
                return setIcon(node, "sliders-horizontal");
            case FilterType.PF2_Trait:
                return setIcon(node, "search");
            case FilterType.PF2_Monster_Type:
            return setIcon(node, "search");
        }

    };
    const edit = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon("pencil");
    };
    const handleEdit = () => {
        const modal = new EditFilterModal(filter);

        modal.onClose = () => {
            if (modal.canceled) return;
            filterStore.update(filter.id, modal.filter);
            dispatch("edit");
        };
        modal.open();
    };
    const trash = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon("trash");
    };
    const warn = (node: HTMLElement) => {
        setIcon(node, "alert-triangle");
    };
    const derivedIcon = (node: HTMLElement) => {
        setIcon(node, "package-search");
    };
</script>

<div class="filter-container">
    <div class="filter">
        <div class="name-container">
            <div class="icon" use:getIcon />
            <div class="text"><span>{filter.text}</span></div>
        </div>
        <div>
            <small
                ><em class="description-container">
                    {#if filter.derive}
                        <div class="icon" use:derivedIcon />
                    {/if}
                    {#if filter.fields.length}
                        {filter.fields.join(", ")}
                    {:else}
                        <div use:warn class="warning-icon icon" />
                        <span class="warning-icon">No fields</span>
                    {/if}
                </em>
            </small>
        </div>
    </div>
    <div class="context">
        <div use:edit class="icon" on:click={() => handleEdit()} />
        <div use:trash class="icon" on:click={() => dispatch("deleted", id)} />
    </div>
</div>

<style scoped>
    .filter-container {
        flex-grow: 1;
        flex-basis: 0;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
    }
    .filter-container:hover .context {
        opacity: 1;
    }
    .name-container {
        display: flex;
        flex-flow: row nowrap;
        gap: 0.5rem;
        align-items: center;
    }
    .description-container {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        --icon-size: 14px;
    }
    .icon {
        display: flex;
        align-items: center;
    }
    .warning-icon {
        color: var(--text-error);
    }
    .context {
        opacity: 0;
        transition: opacity 0.25s;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
</style>
