/* =========================================================
   GRIMOIRE EDITOR
   File: grimoire/js/editor.js
   ========================================================= */

function renderEditor() {
  entryList.innerHTML = `
    <section class="book-editor-page">
      <header class="book-editor-header">
        <label>
          Page Title
          <input
            type="text"
            value="${escapeHtml(currentPage.title)}"
            data-page-title-input
          />
        </label>

        <div class="book-rich-toolbar" data-rich-toolbar>
          <button type="button" data-rich-command="bold"><strong>B</strong></button>
          <button type="button" data-rich-command="italic"><em>I</em></button>
          <button type="button" data-rich-command="underline"><u>U</u></button>
          <button type="button" data-rich-command="createLink">Link</button>
        </div>

        <div class="book-editor-actions">
          <button class="button button--primary button--small" type="button" data-done-editing>
            Done
          </button>

          <button class="button button--small" type="button" data-open-template-menu>
            Templates
          </button>

          <button class="button button--small" type="button" data-link-existing-page>
            Link Page
          </button>

          <button class="button button--small" type="button" data-return-page-to-ashes>
            Return to Ashes
          </button>
        </div>
      </header>

      <div class="book-editor-elements">
        ${currentBlocks.map((block, index) => renderEditableElement(block, index)).join("")}
      </div>

      <div class="book-add-elements">
        ${renderElementButtons()}
      </div>
    </section>
  `;
}

function renderElementButtons() {
  const groups = [...new Set(ELEMENT_TYPES.map((item) => item.group))];

  return `
    <details class="book-add-drawer">
      <summary>✦ Add Page Element</summary>

      <div class="book-add-drawer-panel">
        ${groups
          .map((group) => {
            const groupItems = ELEMENT_TYPES.filter((item) => item.group === group);

            return `
              <div class="book-element-group">
                <p>${group}</p>

                <div>
                  ${groupItems
                    .map(
                      (item) => `
                        <button type="button" data-add-block-type="${item.type}">
                          + ${item.label}
                        </button>
                      `
                    )
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </details>
  `;
}

function renderEditableElement(block, index) {
  const type = block.block_type;
  const content = blockContent(block);
  const metadata = getBlockMetadata(block);

  const controls = `
    <div class="book-element-controls">
      <button type="button" data-move-block-up="${block.id}" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move-block-down="${block.id}" ${index === currentBlocks.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" data-delete-block="${block.id}">Remove</button>
    </div>
  `;

  if (type === "heading") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Heading
          <div
            class="book-rich-input book-rich-heading"
            contenteditable="true"
            data-rich-input
            data-block-input
            data-block-id="${block.id}"
          >${sanitizeHtml(content)}</div>
        </label>
      </section>
    `;
  }

  if (type === "quote" || type === "callout") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Note / Quote
          <div
            class="book-rich-input book-rich-callout"
            contenteditable="true"
            data-rich-input
            data-block-input
            data-block-id="${block.id}"
          >${sanitizeHtml(content)}</div>
        </label>
      </section>
    `;
  }

  if (type === "divider") {
    return `
      <section class="book-edit-element book-edit-element--divider" data-block-id="${block.id}">
        ${controls}
        <p>Divider</p>
        <div class="book-reader-divider">✦ ☽ ✦ ☾ ✦</div>
      </section>
    `;
  }

  if (["checklist", "bulleted_list", "numbered_list", "ingredient_list"].includes(type)) {
    const label = ELEMENT_TYPES.find((item) => item.type === type)?.label || "List";

    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          ${label}
          <textarea
            rows="6"
            data-block-input
            data-block-id="${block.id}"
            placeholder="One item per line"
          >${escapeHtml(content)}</textarea>
        </label>
      </section>
    `;
  }

  if (type === "correspondence") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Correspondence Box
          <textarea
            rows="6"
            data-block-input
            data-block-id="${block.id}"
            placeholder="Planet:\\nElement:\\nDeities:\\nUses:"
          >${escapeHtml(content)}</textarea>
        </label>
      </section>
    `;
  }

  if (type === "image") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <label>
          Image URL
          <input
            type="url"
            value="${escapeHtml(metadata.url || content)}"
            data-block-input
            data-block-id="${block.id}"
            data-metadata-field="url"
          />
        </label>

        <label>
          Caption
          <input
            type="text"
            value="${escapeHtml(metadata.caption || "")}"
            data-block-metadata-input
            data-block-id="${block.id}"
            data-metadata-field="caption"
          />
        </label>
      </section>
    `;
  }

  if (type === "page_link") {
    return `
      <section class="book-edit-element" data-block-id="${block.id}">
        ${controls}

        <p>Page Link</p>

        <button type="button" data-choose-page-for-block="${block.id}">
          ${metadata.target_page_id ? "Change Linked Page" : "Choose Linked Page"}
        </button>

        <p class="book-section-empty">
          ${
            metadata.target_page_id
              ? `Linked to ${escapeHtml(pages.find((page) => page.id === metadata.target_page_id)?.title || "page")}`
              : "No page linked yet."
          }
        </p>
      </section>
    `;
  }

  return `
    <section class="book-edit-element" data-block-id="${block.id}">
      ${controls}

      <label>
        Paragraph
        <div
          class="book-rich-input"
          contenteditable="true"
          data-rich-input
          data-block-input
          data-block-id="${block.id}"
        >${sanitizeHtml(content)}</div>
      </label>
    </section>
  `;
}

async function createElement(type = "text") {
  const user = requireUser();
  if (!user || !currentBook || !currentPage) return;

  const defaultContent = type === "heading" ? "New Heading" : "";

  const { data, error } = await db
    .from("grimoire_blocks")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      page_id: currentPage.id,
      block_type: type,
      content: defaultContent,
      metadata: {},
      rich_content: null,
      sort_order: currentBlocks.length
    })
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks.push(data);
  pageMode = "edit";
  renderEditor();
  flashStatus("Element added.");
}

async function moveBlock(blockId, direction) {
  const index = currentBlocks.findIndex((block) => block.id === blockId);
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= currentBlocks.length) return;

  const reordered = [...currentBlocks];
  const [movedBlock] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, movedBlock);

  currentBlocks = reordered.map((block, newIndex) => ({
    ...block,
    sort_order: newIndex
  }));

  renderEditor();

  const jobs = currentBlocks.map((block) =>
    db
      .from("grimoire_blocks")
      .update({ sort_order: block.sort_order })
      .eq("id", block.id)
  );

  const results = await Promise.all(jobs);
  const failed = results.find((result) => result.error);

  if (failed) {
    setStatus(failed.error.message);
    await loadBlocks(currentPage);
    renderEditor();
    return;
  }

  flashStatus("Element moved.");
}

async function deleteBlock(blockId) {
  if (currentBlocks.length === 1) {
    flashStatus("A page needs at least one paragraph.");
    return;
  }

  const confirmed = window.confirm("Remove this element from the page?");
  if (!confirmed) return;

  const { error } = await db.from("grimoire_blocks").delete().eq("id", blockId);

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.filter((block) => block.id !== blockId);
  currentBlocks = currentBlocks.map((block, index) => ({
    ...block,
    sort_order: index
  }));

  renderEditor();
  flashStatus("Element removed.");
}

function runRichCommand(command) {
  if (!activeRichEditor) return;

  activeRichEditor.focus();

  if (command === "createLink") {
    const url = window.prompt("Paste the link URL:");
    if (!url) return;

    document.execCommand("createLink", false, url);
    return;
  }

  document.execCommand(command, false, null);
}
