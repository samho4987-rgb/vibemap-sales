const API_BASE = "https://license-server-wxvb.onrender.com";

// 콜드스타트 완화: 페이지 로드 즉시 서버를 깨워둔다. 실패해도 무시.
fetch(`${API_BASE}/api/auth/health`).catch(() => {});

const grid = document.getElementById("product-grid");
const productSelect = document.getElementById("product");
const form = document.getElementById("applyForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

let products = [];

function renderProducts() {
  grid.innerHTML = "";
  productSelect.innerHTML = "";

  products.forEach((p) => {
    const pending = p.status === "pending";

    const card = document.createElement("div");
    card.className = "product-card" + (pending ? " pending" : "");
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div class="price">${p.price}</div>
      <p class="desc">${p.description}</p>
      <button type="button" data-key="${p.key}">${pending ? "출시 알림 신청" : "신청하기"}</button>
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

fetch("products.json")
  .then((res) => res.json())
  .then((data) => {
    products = data;
    renderProducts();
  })
  .catch(() => {
    grid.innerHTML = '<p class="loading">상품 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>';
  });

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

    setMessage("접수되었습니다. 계좌 안내는 곧 연락드립니다.", "success");
    form.reset();
  } catch (err) {
    clearTimeout(timeoutId);
    setMessage("접수에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
