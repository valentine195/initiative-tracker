<script lang="ts">
    import {
        ButtonComponent,
        ExtraButtonComponent,
        Notice,
        Setting,
        TextComponent
    } from "obsidian";
    import { type Filter, FilterType } from "./filter";
    import copy from "fast-copy";
    import { createEventDispatcher } from "svelte";
    import DraggableField from "./DraggableField.svelte";
    import { writable } from "svelte/store";

    export let filter: Filter;
    export let original: Filter;

    const dispatch = createEventDispatcher<{ cancel: null; update: Filter }>();

    const reset = (node: HTMLElement) => {
        new Setting(node).setName("Reset").addExtraButton((b) => {
            b.setIcon("reset").onClick(() => {
                filter = copy(original);
            });
        });
    };

    const type = (node: HTMLElement) => {
        new Setting(node).setName("Filter Type").addDropdown((d) => {
            d.addOption(`${FilterType.Range}`, "Range");
            d.addOption(`${FilterType.Options}`, "Options");
            d.addOption(`${FilterType.Search}`, "Search");
            d.addOption(`${FilterType.PF2_Level_Range}`, "PF2 - Level");
            d.addOption(`${FilterType.PF2_Monster_Type}`, "PF2 - Monster type");
            d.addOption(`${FilterType.PF2_Trait}`, "PF2 - Traits");
            d.setValue(`${filter.type}`).onChange((v) => {
                filter.type = Number(v);
                switch (filter.type) {
                    case FilterType.Range:
                        filter.options = [0, 0];
                        break;
                    case FilterType.Search:
                        filter.options = "";
                        break;
                    case FilterType.Options:
                        filter.options = [];
                        break;
                    case FilterType.PF2_Level_Range:
                        filter.options = [-1, 25];
                        break;
                    case FilterType.PF2_Monster_Type:
                        filter.options = "";
                        break;
                    case FilterType.PF2_Trait:
                        filter.options = "";
                        break;
                }
            });
        });
    };
    const text = (node: HTMLElement) => {
        new Setting(node).setName("Display Text").addText((t) => {
            t.setValue(filter.text).onChange((v) => (filter.text = v));
        });
    };
    let field = writable(""),
        addField: ExtraButtonComponent;
    $: addField?.setDisabled(!$field?.length);

    const fields = (node: HTMLElement) => {
        const opts = filter;
        let input: TextComponent;
        new Setting(node)
            .setName("Fields")
            .addText((t) => {
                input = t.onChange((v) => ($field = v));
            })
            .addExtraButton(
                (b) =>
                    (addField = b.setIcon("plus-circle").onClick(() => {
                        if (opts.fields.includes($field)) {
                            new Notice(
                                createFragment((e) => {
                                    e.createSpan({ text: "The field " });
                                    e.createEl("code", { text: $field });
                                    e.createSpan(
                                        " has already been added to the options for this filter."
                                    );
                                })
                            );
                            return;
                        }
                        opts.fields = [...opts.fields, $field];
                        filter = { ...filter };
                        $field = "";
                        input.setValue($field);
                    }))
            );
    };
    const updateFields = (fields: string[]) => {
        filter.fields = fields;
    };
    const derive = (node: HTMLElement) => {
        if (filter.type == FilterType.Search) return;
        new Setting(node).setName("Derive Options").addToggle((t) => {
            t.setValue(filter.derive).onChange((v) => (filter.derive = v));
        });
    };
    const options = (node: HTMLElement) => {
        new Setting(node)
            .setName("Options")
            .addText((t) => t)
            .addExtraButton((b) => b.setIcon("plus-circle"));
    };
    const updateOptions = (fields: string[]) => {
        filter.options = fields;
    };
    const range = (node: HTMLElement) => {
        if (filter.type != FilterType.Range) return;
        const range = filter;
        new Setting(node)
            .setName("Options")
            .addText(
                (t) =>
                    (t
                        .setValue(`${range.options[0]}`)
                        .onChange(
                            (v) => (range.options[0] = Number(v))
                        ).inputEl.type = "number")
            )
            .addText(
                (t) =>
                    (t
                        .setValue(`${range.options[1]}`)
                        .onChange(
                            (v) => (range.options[1] = Number(v))
                        ).inputEl.type = "number")
            );
    };
    const cancel = (node: HTMLElement) => {
        new ButtonComponent(node).setButtonText("Cancel").setCta();
    };
    $: dispatch("update", filter);
</script>

<div use:reset />
<div use:type />
<div use:text />
<div use:fields />
{#key filter}
    <DraggableField
        fields={filter.fields}
        on:update={(evt) => updateFields(evt.detail)}
    />
    <div use:derive />
    {#if !filter.derive}
        {#if filter.type == FilterType.Range}
            <div use:range />
        {:else if filter.type == FilterType.Options}
            <div use:options />
            <DraggableField
                fields={filter.options}
                on:update={(evt) => updateOptions(evt.detail)}
            />
        {/if}
    {/if}
{/key}
<div class="cancel-button">
    <div use:cancel on:click={() => dispatch("cancel")} />
</div>
