/* =========================================================
   GRIMOIRE DATABASE
   File: grimoire/js/database.js
   ========================================================= */

async function loadOrCreateBook(user) {
  const { data: existingBooks, error: bookError } = await db
    .from("grimoire_books")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (bookError) throw bookError;

  if (existingBooks && existingBooks.length > 0) {
    currentBook = existingBooks[0];
    return currentBook;
  }

  const { data: newBook, error: createError } = await db
    .from("grimoire_books")
    .insert({
      user_id: user.id,
      title: "Book of Shadows"
    })
    .select()
    .single();

  if (createError) throw createError;

  currentBook = newBook;
  return currentBook;
}

async function loadSections() {
  if (!currentBook) return;

  const { data, error } = await db
    .from("grimoire_sections")
    .select("*")
    .eq("book_id", currentBook.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  sections = data || [];
}

async function loadPages() {
  if (!currentBook) return;

  const { data, error } = await db
    .from("grimoire_pages")
    .select("*")
    .eq("book_id", currentBook.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  pages = data || [];
}

async function loadBlocks(page) {
  const user = requireUser();
  if (!user || !currentBook || !page) return;

  const { data, error } = await db
    .from("grimoire_blocks")
    .select("*")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  currentBlocks = data || [];

  if (currentBlocks.length > 0) return;

  const { data: firstBlock, error: createError } = await db
    .from("grimoire_blocks")
    .insert({
      user_id: user.id,
      book_id: currentBook.id,
      page_id: page.id,
      block_type: "text",
      content: "",
      metadata: {},
      rich_content: null,
      sort_order: 0
    })
    .select()
    .single();

  if (createError) throw createError;

  currentBlocks = [firstBlock];
}

async function loadPageLinks(page) {
  const user = requireUser();
  if (!user || !currentBook || !page) return;

  const { data, error } = await db
    .from("grimoire_page_links")
    .select("*")
    .eq("source_page_id", page.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Page links could not be loaded:", error.message);
    pageLinks = [];
    return;
  }

  pageLinks = data || [];
}

async function saveBlock(blockId, value, isRich = false) {
  const updatePayload = isRich
    ? {
        content: value,
        rich_content: { html: sanitizeHtml(value) },
        updated_at: new Date().toISOString()
      }
    : {
        content: value,
        updated_at: new Date().toISOString()
      };

  const { data, error } = await db
    .from("grimoire_blocks")
    .update(updatePayload)
    .eq("id", blockId)
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.map((block) =>
    block.id === data.id ? data : block
  );

  flashStatus("Saved.");
}

async function saveBlockMetadata(blockId, field, value) {
  const block = currentBlocks.find((item) => item.id === blockId);
  if (!block) return;

  const metadata = {
    ...getBlockMetadata(block),
    [field]: value
  };

  const { data, error } = await db
    .from("grimoire_blocks")
    .update({
      metadata,
      content: field === "url" ? value : block.content,
      updated_at: new Date().toISOString()
    })
    .eq("id", blockId)
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentBlocks = currentBlocks.map((item) =>
    item.id === data.id ? data : item
  );

  flashStatus("Saved.");
}

async function saveCurrentPageTitle() {
  if (!currentPage) return;

  const titleInput = document.querySelector("[data-page-title-input]");
  if (!titleInput) return;

  const newTitle = titleInput.value.trim() || "Untitled Page";

  const { data, error } = await db
    .from("grimoire_pages")
    .update({
      title: newTitle,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentPage.id)
    .select()
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  currentPage = data;
  pages = pages.map((page) => (page.id === data.id ? data : page));

  if (grimoireHeading) grimoireHeading.textContent = data.title;

  renderShelf();
  flashStatus("Title saved.");
}

async function saveAllVisibleEdits() {
  const titleInput = document.querySelector("[data-page-title-input]");
  const blockInputs = document.querySelectorAll("[data-block-input]");
  const metadataInputs = document.querySelectorAll("[data-block-metadata-input]");

  const jobs = [];

  if (titleInput && currentPage) {
    const newTitle = titleInput.value.trim() || "Untitled Page";

    jobs.push(
      db
        .from("grimoire_pages")
        .update({
          title: newTitle,
          updated_at: new Date().toISOString()
        })
        .eq("id", currentPage.id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;

          currentPage = data;
          pages = pages.map((page) => (page.id === data.id ? data : page));
        })
    );
  }

  blockInputs.forEach((input) => {
    const blockId = input.dataset.blockId;
    const isRich = input.hasAttribute("contenteditable");
    const metadataField = input.dataset.metadataField;

    if (metadataField) {
      jobs.push(saveBlockMetadata(blockId, metadataField, input.value));
      return;
    }

    const value = isRich ? input.innerHTML : input.value;
    jobs.push(saveBlock(blockId, value, isRich));
  });

  metadataInputs.forEach((input) => {
    jobs.push(
      saveBlockMetadata(
        input.dataset.blockId,
        input.dataset.metadataField,
        input.value
      )
    );
  });

  await Promise.all(jobs);
}
