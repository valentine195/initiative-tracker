<script lang="ts">
    import { TextComponent, debounce } from "obsidian";
    import type { StringFilterStore, PF2_TraitFilterStore, PF2_Monster_TypeFilterStore } from "src/builder/stores/filter/filter";

    export let filter: StringFilterStore|PF2_TraitFilterStore|PF2_Monster_TypeFilterStore;
    const search = (node: HTMLElement) => {
        new TextComponent(node).setPlaceholder(filter.text).onChange(
            debounce((v) => {
                $filter = v;
            }, 10)
        );
    };
</script>

<div class="search" use:search />

<style scoped>
    .search,
    .search :global(input) {
        width: 100%;
    }
</style>
