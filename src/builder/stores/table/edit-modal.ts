import { type TableHeaderState, SortFunctions } from "src/builder/builder.types";
import { Modal, Setting, TextAreaComponent } from "obsidian";
import { EditorView } from "@codemirror/view";
import { editorFromTextArea } from "../../../utils/editor/index";

export class EditModal extends Modal {
    public header: TableHeaderState;
    public editing: boolean;
    editor: EditorView;
    public canceled = false;
    onOpen() {
        this.titleEl.setText(this.editing ? "Edit Header" : "Create Header");
        this.display();
    }
    display() {
        this.contentEl.empty();
        new Setting(this.contentEl).setName("Display Text").addText((t) =>
            t.setValue(this.header.text).onChange((v) => {
                this.header.text = v;
            })
        );
        new Setting(this.contentEl)
            .setName("Linked Property")
            .addText((t) =>
                t
                    .setValue(this.header.field)
                    .onChange((v) => (this.header.field = v))
            );
        new Setting(this.contentEl)
            .setName("Sort Type")
            .setDesc(
                "This determines how the field is sorted. Use the appropriate type for the data type of the field."
            )
            .addDropdown((t) => {
                t.addOption(`${SortFunctions.LOCAL_COMPARE}`, "String");
                t.addOption(`${SortFunctions.CONVERT_FRACTION}`, "Number");
                t.addOption(`${SortFunctions.PF2_LEVEL}`, "PF2 - Level");
                t.addOption(`${SortFunctions.PF2_TYPE}`, "PF2 - Monster type");
                t.addOption(`${SortFunctions.PF2_TRAIT}`, "PF2 - Traits");
                t.addOption(`${SortFunctions.CUSTOM}`, "Custom");
                t.setValue(`${this.header.type}`).onChange((v) => {
                    this.header.type = Number(v);
                    if (this.header.type == SortFunctions.CUSTOM) {
                        this.header.func = ``;
                    } else {
                        delete this.header.func;
                    }
                    this.display();
                });
            });
        if ("func" in this.header) {
            new Setting(this.contentEl)
                .setName("Custom Sorting Function")
                .setDesc(
                    createFragment((e) => {
                        e.createSpan({
                            text: "Specify a custom sorting JavaScript function."
                        });
                        e.createEl("br");
                        e.createEl("br");

                        e.createSpan({
                            text: "This function receives two monster objects, "
                        });
                        e.createEl("code", { text: "a" });
                        e.createSpan({ text: " and " });
                        e.createEl("code", { text: "b" });
                        e.createSpan({
                            text: ", and must return a number. The number determines sort order."
                        });
                    })
                );
            const component = new TextAreaComponent(this.contentEl).setValue(
                this.header.func!
            );
            component.inputEl.addClass("initiative-tracker-textarea");
            this.editor = editorFromTextArea(
                component.inputEl,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        this.header.func = update.state.doc.toString();
                    }
                })
            );
        }
        new Setting(this.contentEl).addButton((b) => {
            b.setButtonText("Cancel")
                .setCta()
                .onClick(() => {
                    this.canceled = true;
                    this.close();
                });
        });
    }
    close() {
        this.editor?.destroy();
        super.close();
    }
}
