/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

const SELECTED_PRODUCTS_STORAGE_KEY = "lorealSelectedProductIds";
const WORKER_ENDPOINT = "";
const WORKER_ENDPOINT_PLACEHOLDER =
  "https://YOUR-WORKER-SUBDOMAIN.workers.dev/chat";

/* Global state for products + conversation */
let allProducts = [];
let selectedProducts = [];
const conversationHistory = [];
let latestGeneratedRoutine = "";

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Check if a product is currently selected */
function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Save selected product IDs to localStorage */
function saveSelectedProductsToStorage() {
  const selectedProductIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(
    SELECTED_PRODUCTS_STORAGE_KEY,
    JSON.stringify(selectedProductIds),
  );
}

/* Load selected product IDs from localStorage */
function loadSelectedProductsFromStorage() {
  const rawIds = localStorage.getItem(SELECTED_PRODUCTS_STORAGE_KEY);

  if (!rawIds) {
    return;
  }

  const savedIds = JSON.parse(rawIds);
  if (!Array.isArray(savedIds)) {
    return;
  }

  selectedProducts = allProducts.filter((product) =>
    savedIds.includes(product.id),
  );
}

/* Keep card styles synced with selected products */
function updateProductCardSelectionStyles() {
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    const productId = Number(card.dataset.productId);
    if (isProductSelected(productId)) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

/* Apply category + keyword filters together */
function applyProductFilters() {
  const selectedCategory = categoryFilter.value || "";
  const searchText = productSearch.value.trim().toLowerCase();

  /* If both filters are empty, keep the grid empty */
  if (!searchText && !selectedCategory) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Choose a category or type in search to view products
      </div>
    `;
    return;
  }

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      !searchText ||
      product.name.toLowerCase().includes(searchText) ||
      product.brand.toLowerCase().includes(searchText) ||
      product.category.toLowerCase().includes(searchText) ||
      product.description.toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found in this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      isProductSelected(product.id) ? "selected" : ""
    }" data-product-id="${product.id}" tabindex="0" aria-label="${product.brand} ${product.name}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <div class="product-description-overlay" aria-hidden="true">
        <p>${product.description}</p>
      </div>
    </div>
  `,
    )
    .join("");

  /* Add click handlers so users can select and unselect products */
  const productCards = document.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    card.addEventListener("click", () => {
      const productId = Number(card.dataset.productId);
      const clickedProduct = allProducts.find(
        (product) => product.id === productId,
      );

      if (!clickedProduct) {
        return;
      }

      const alreadySelected = selectedProducts.some(
        (product) => product.id === clickedProduct.id,
      );

      if (alreadySelected) {
        selectedProducts = selectedProducts.filter(
          (product) => product.id !== clickedProduct.id,
        );
      } else {
        selectedProducts.push(clickedProduct);
      }

      saveSelectedProductsToStorage();
      renderSelectedProducts();
      updateProductCardSelectionStyles();
    });
  });

  updateProductCardSelectionStyles();
}

/* Render selected product names in the selected products box */
function renderSelectedProducts() {
  clearSelectionsButton.disabled = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="placeholder-message">No products selected yet.</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-item">
        <span>${product.brand} - ${product.name}</span>
        <button
          type="button"
          class="remove-selected-btn"
          data-product-id="${product.id}"
          aria-label="Remove ${product.name}"
        >
          x
        </button>
      </div>
    `,
    )
    .join("");

  /* Allow removing selected products directly from the list */
  const removeButtons = document.querySelectorAll(".remove-selected-btn");
  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.productId);
      selectedProducts = selectedProducts.filter(
        (product) => product.id !== productId,
      );
      saveSelectedProductsToStorage();
      renderSelectedProducts();
      updateProductCardSelectionStyles();
    });
  });
}

/* Clear all selected products at once */
clearSelectionsButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProductsToStorage();
  renderSelectedProducts();
  updateProductCardSelectionStyles();
});

/* Helper: append a message bubble to the chat window */
function addChatMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.style.marginBottom = "12px";
  messageElement.style.whiteSpace = "pre-line";

  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You: " : "Advisor: ";

  const messageText = document.createElement("span");
  messageText.textContent = text;

  messageElement.appendChild(label);
  messageElement.appendChild(messageText);

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Build a text block from selected products to send as AI context */
function getSelectedProductsContext() {
  if (selectedProducts.length === 0) {
    return "No products are currently selected.";
  }

  return selectedProducts
    .map(
      (product) => `- ${product.brand} ${product.name}: ${product.description}`,
    )
    .join("\n");
}

/* Keep only the product fields needed for routine generation */
function getSelectedProductsForRoutine() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

/* Read Worker config from window when available */
function getWorkerConfig() {
  const configuredEndpoint = (window.WORKER_ENDPOINT || "").trim();
  const isPlaceholderEndpoint =
    configuredEndpoint === WORKER_ENDPOINT_PLACEHOLDER ||
    configuredEndpoint.includes("YOUR-WORKER-SUBDOMAIN");

  return {
    endpoint:
      configuredEndpoint && !isPlaceholderEndpoint
        ? configuredEndpoint
        : WORKER_ENDPOINT,
    token: (window.WORKER_TOKEN || "").trim(),
  };
}

/* Send a chat request to Cloudflare Worker (instead of OpenAI directly) */
async function getWorkerResponse(messages) {
  const workerConfig = getWorkerConfig();

  if (!workerConfig.endpoint) {
    throw new Error(
      "Missing Worker endpoint. Set window.WORKER_ENDPOINT in secrets.js to your deployed Cloudflare Worker URL.",
    );
  }

  const headers = {
    "Content-Type": "application/json",
  };

  /* Optional extra protection: require a Worker token */
  if (workerConfig.token) {
    headers.Authorization = `Bearer ${workerConfig.token}`;
  }

  const response = await fetch(workerConfig.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages,
      model: "gpt-4o",
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error || "Worker request failed.";
    throw new Error(errorMessage);
  }

  const data = await response.json();

  /* Accept either a custom Worker shape or OpenAI-compatible shape */
  const aiMessage =
    data.reply || data.output_text || data?.choices?.[0]?.message?.content;

  if (!aiMessage) {
    throw new Error("Worker returned no AI message.");
  }

  return aiMessage;
}

/* Generate a routine from JSON data for selected products */
async function generateRoutineFromSelectedProducts() {
  const selectedProductsForRoutine = getSelectedProductsForRoutine();

  const routineUserMessage =
    "Build a simple AM and PM routine using only these selected products. Use numbered steps and put each new step on a new line. Include order, frequency, and one safety tip.";

  const routinePayload = {
    request: routineUserMessage,
    selectedProducts: selectedProductsForRoutine,
  };

  const messages = [
    {
      role: "system",
      content:
        "You are a friendly skincare and beauty routine advisor. Use only the product JSON the user provides. Give a clear AM and PM routine in short sections.",
    },
    {
      role: "user",
      content: JSON.stringify(routinePayload, null, 2),
    },
  ];

  const aiMessage = await getWorkerResponse(messages);

  latestGeneratedRoutine = aiMessage;

  conversationHistory.push({
    role: "user",
    content: JSON.stringify(routinePayload, null, 2),
  });
  conversationHistory.push({ role: "assistant", content: aiMessage });

  return aiMessage;
}

/* Send messages to the OpenAI Chat Completions API */
async function getOpenAIResponse(userMessage) {
  const selectedProductsContext = getSelectedProductsContext();

  const routineContext = latestGeneratedRoutine
    ? `Latest generated routine:\n${latestGeneratedRoutine}`
    : "No routine has been generated yet.";

  /* Keep instructions simple and clear for a helpful beauty advisor response */
  const messages = [
    {
      role: "system",
      content:
        "You are a friendly skincare and beauty routine advisor. Only answer questions related to the generated routine or beauty topics such as skincare, haircare, makeup, fragrance, grooming, and suncare. If a question is outside this scope, politely refuse and steer back to routine/beauty help. Keep answers beginner-friendly with clear steps.",
    },
    {
      role: "system",
      content: `Context:\n${routineContext}\n\nCurrently selected products:\n${selectedProductsContext}`,
    },
    ...conversationHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];

  const aiMessage = await getWorkerResponse(messages);

  conversationHistory.push({ role: "user", content: userMessage });
  conversationHistory.push({ role: "assistant", content: aiMessage });

  return aiMessage;
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  e.preventDefault();
  applyProductFilters();
});

/* Live search while user types */
productSearch.addEventListener("input", () => {
  applyProductFilters();
});

/* Generate a full routine from selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addChatMessage("assistant", "Please select at least one product first.");
    return;
  }

  addChatMessage(
    "user",
    `Generate a routine with my ${selectedProducts.length} selected products.`,
  );

  generateRoutineButton.disabled = true;
  generateRoutineButton.textContent = "Generating...";

  try {
    const aiResponse = await generateRoutineFromSelectedProducts();
    addChatMessage("assistant", aiResponse);
  } catch (error) {
    addChatMessage("assistant", `Error: ${error.message}`);
  } finally {
    generateRoutineButton.disabled = false;
    generateRoutineButton.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
});

/* Chat form submission handler - sends user follow-up questions to OpenAI */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  addChatMessage("user", message);
  userInput.value = "";

  try {
    const aiResponse = await getOpenAIResponse(message);
    addChatMessage("assistant", aiResponse);
  } catch (error) {
    addChatMessage("assistant", `Error: ${error.message}`);
  }
});

/* Initialize app data and selected products placeholder */
async function initializeApp() {
  allProducts = await loadProducts();
  loadSelectedProductsFromStorage();
  renderSelectedProducts();
}

initializeApp();
