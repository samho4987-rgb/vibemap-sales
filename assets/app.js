const API_BASE = "https://license-server-wxvb.onrender.com";

// 콜드스타트 완화: 페이지 로드 즉시 서버를 깨워둔다. 실패해도 무시.
fetch(`${API_BASE}/api/auth/health`).catch(() => {});

let products = [];
let productsPromise = null;

function loadProducts() {
  if (!productsPromise) {
    productsPromise = fetch("products.json").then((res) => res.json()).then((data) => {
      products = data;
      return products;
    });
  }
  return productsPromise;
}

// ── 랜딩 페이지: 상품 카드 + 신청 폼 (index.html에만 존재) ──────────────
const grid = document.getElementById("product-grid");
const productSelect = document.getElementById("product");
const form = document.getElementById("applyForm");

if (grid && productSelect) {
  function renderProducts() {
    grid.innerHTML = "";
    productSelect.innerHTML = '<option value="">상품을 선택해 주세요</option>';

    products.forEach((p) => {
      const pending = p.status === "pending";

      const card = document.createElement("div");
      card.className = "product-card" + (pending ? " pending" : "");
      card.innerHTML = `
        <h3>${p.name}</h3>
        <div class="price-tag">${p.price}</div>
        <p class="desc">${p.description}</p>
        <button type="button" class="btn-card btn-card-primary" data-key="${p.key}">${pending ? "출시 알림 신청" : "신청하기"}</button>
      `;
      card.querySelector("button").addEventListener("click", () => {
        productSelect.value = p.key;
        document.getElementById("apply-form").scrollIntoView({ behavior: "smooth" });
        document.getElementById("name").focus();
      });
      grid.appendChild(card);

      const option = document.createElement("option");
      option.value = p.key;
      option.textContent = pending ? `${p.name} (준비중 - 출시 알림)` : p.name;
      productSelect.appendChild(option);
    });
  }

  loadProducts()
    .then(renderProducts)
    .catch(() => {
      grid.innerHTML = '<p class="loading">상품 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>';
    });
}

if (form) {
  const submitBtn = document.getElementById("submitBtn");
  const formMessage = document.getElementById("formMessage");

  function setMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const memo = document.getElementById("memo").value.trim();
    const product = productSelect.value;

    if (!name || !phone || !product) {
      setMessage("이름, 휴대폰 번호, 신청 상품은 필수입니다.", "error");
      return;
    }

    submitBtn.disabled = true;
    setMessage("접수 중입니다... 서버 상태에 따라 최대 1분 정도 걸릴 수 있습니다.", "pending");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_BASE}/api/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, product, memo }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("REQUEST_FAILED");
      }

      // 신청이 서버에 접수됐으니, 입금 계좌 안내 페이지로 이동시킨다.
      const params = new URLSearchParams({ product, name, phone });
      window.location.href = `checkout.html?${params.toString()}`;
    } catch (err) {
      clearTimeout(timeoutId);
      setMessage("접수에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
      submitBtn.disabled = false;
    }
  });
}

// ── 입금 안내 페이지 (checkout.html에만 존재) ──────────────────────────
const checkoutSummary = document.getElementById("checkout-summary");

if (checkoutSummary) {
  // TODO: 실제 입금 계좌로 교체
  const BANK_INFO = {
    bank: "OO은행",
    accountNumber: "000-000000-00-000",
    holder: "바이브프롭테크",
  };

  const params = new URLSearchParams(window.location.search);
  const productKey = params.get("product") || "";
  const name = params.get("name") || "";
  const phone = params.get("phone") || "";

  loadProducts().then(() => {
    const product = products.find((p) => p.key === productKey);
    const nameEl = document.getElementById("checkout-product-name");
    const priceEl = document.getElementById("checkout-product-price");
    if (nameEl) nameEl.textContent = product ? product.name : "-";
    if (priceEl) priceEl.textContent = product ? product.price : "-";
  });

  const bankEl = document.getElementById("checkout-bank");
  if (bankEl) {
    bankEl.textContent = `${BANK_INFO.bank} ${BANK_INFO.accountNumber} (예금주: ${BANK_INFO.holder})`;
  }

  const depositorInput = document.getElementById("depositorName");
  const contactInput = document.getElementById("contactPhone");
  if (depositorInput) depositorInput.value = name;
  if (contactInput) contactInput.value = phone;
}
