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

// ── 카카오 로그인 / 마이페이지 공통 ──────────────────────────────────
const KAKAO_JS_KEY = "3c957621bd7c1f5af6d724a24f46a973";

const PORTAL_TOKEN_KEY = "portalToken";
const PORTAL_UNLINKED_KEY = "portalUnlinkedToken";
const PORTAL_NICKNAME_KEY = "portalNickname";

function portalFetch(path, options = {}) {
  const token = localStorage.getItem(PORTAL_TOKEN_KEY);
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token || ""}`,
    },
  });
}

// ── 로그인 페이지 (login.html에만 존재) ────────────────────────────────
const kakaoLoginBtn = document.getElementById("kakaoLoginBtn");

if (kakaoLoginBtn) {
  const loginMessage = document.getElementById("loginMessage");

  function setLoginMessage(text, type) {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY);
  }

  kakaoLoginBtn.addEventListener("click", () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      setLoginMessage("카카오 로그인 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.", "error");
      return;
    }

    kakaoLoginBtn.disabled = true;
    setLoginMessage("카카오 로그인 중입니다...", "pending");

    window.Kakao.Auth.login({
      success: async (authObj) => {
        try {
          const res = await fetch(`${API_BASE}/api/portal/kakao/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: authObj.access_token }),
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "LOGIN_FAILED");
          }

          if (data.linked) {
            localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
            localStorage.removeItem(PORTAL_UNLINKED_KEY);
            window.location.href = "mypage.html";
          } else {
            localStorage.setItem(PORTAL_UNLINKED_KEY, data.token);
            localStorage.setItem(PORTAL_NICKNAME_KEY, data.nickname || "");
            window.location.href = "link.html";
          }
        } catch (err) {
          setLoginMessage("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
          kakaoLoginBtn.disabled = false;
        }
      },
      fail: () => {
        setLoginMessage("카카오 로그인이 취소되었습니다.", "error");
        kakaoLoginBtn.disabled = false;
      },
    });
  });
}

// ── 계정 연결 페이지 (link.html에만 존재) ──────────────────────────────
const linkForm = document.getElementById("linkForm");

if (linkForm) {
  const nicknameEl = document.getElementById("linkNickname");
  const nickname = localStorage.getItem(PORTAL_NICKNAME_KEY);
  if (nicknameEl && nickname) nicknameEl.textContent = nickname;

  const unlinkedToken = localStorage.getItem(PORTAL_UNLINKED_KEY);
  if (!unlinkedToken) {
    window.location.href = "login.html";
  }

  const linkMessage = document.getElementById("linkMessage");
  function setLinkMessage(text, type) {
    linkMessage.textContent = text;
    linkMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  linkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const phone = document.getElementById("phone").value.trim();
    if (!phone) return;

    setLinkMessage("연결하는 중입니다...", "pending");

    try {
      const res = await fetch(`${API_BASE}/api/portal/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${unlinkedToken}`,
        },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "NO_MATCHING_ACCOUNT") {
          setLinkMessage("일치하는 라이선스 계정을 찾을 수 없습니다. 신청 시 입력한 전화번호와 같은지 확인해 주세요.", "error");
        } else if (data.error === "TOKEN_EXPIRED") {
          setLinkMessage("연결 세션이 만료되었습니다. 다시 로그인해 주세요.", "error");
        } else {
          setLinkMessage("연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        }
        return;
      }

      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      localStorage.removeItem(PORTAL_UNLINKED_KEY);
      localStorage.removeItem(PORTAL_NICKNAME_KEY);
      window.location.href = "mypage.html";
    } catch (err) {
      setLinkMessage("연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    }
  });
}

// ── 마이페이지 사이드바 + 로그아웃 (mypage.html, profile.html 공통) ────
const logoutLink = document.getElementById("logoutLink");

if (logoutLink) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    window.location.href = "index.html";
  });
}

function loadPortalMe() {
  if (!localStorage.getItem(PORTAL_TOKEN_KEY)) {
    window.location.href = "login.html";
    return Promise.reject(new Error("NO_TOKEN"));
  }

  return portalFetch("/api/portal/me").then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      window.location.href = "login.html";
      throw new Error("UNAUTHORIZED");
    }
    if (!res.ok) {
      throw new Error("REQUEST_FAILED");
    }
    return res.json();
  });
}

function renderSidebar(me) {
  const avatarEl = document.getElementById("sidebarAvatar");
  const nameEl = document.getElementById("sidebarName");
  const loginIdEl = document.getElementById("sidebarLoginId");
  if (avatarEl) avatarEl.textContent = (me.name || me.login_id || "?").slice(0, 1);
  if (nameEl) nameEl.textContent = me.name ? `${me.name} 소장님` : me.login_id;
  if (loginIdEl) loginIdEl.textContent = me.login_id;
}

// ── 마이페이지: 구독/라이선스 정보 (mypage.html에만 존재) ───────────────
const mypagePortal = document.getElementById("mypage-portal");

if (mypagePortal) {
  loadPortalMe()
    .then((me) => {
      renderSidebar(me);

      const statusClass = me.subscription_active ? "active" : "";
      const statusText = me.status_label || (me.subscription_active ? "이용 중" : "미활성");

      mypagePortal.innerHTML = `
        <div class="card-header">
          <div><h3>${me.district_name || "지역 미지정"} 구독</h3><p class="plan-desc">${me.plan_type === "YEARLY" ? "연간" : "월간"} 구독 · ${me.tier}</p></div>
          <span class="badge-status ${statusClass}">${statusText}</span>
        </div>
        <div class="card-body">
          <div class="plan-detail-row">
            <div class="plan-detail"><span class="label">만료일</span><span class="value">${me.expires_at ? me.expires_at.slice(0, 10) : "미발급"}</span></div>
            <div class="plan-detail"><span class="label">아이디</span><span class="value">${me.login_id}</span></div>
          </div>
        </div>
      `;
    })
    .catch(() => {
      if (mypagePortal) {
        mypagePortal.innerHTML = '<p class="loading">정보를 불러오지 못했습니다. 새로고침해 주세요.</p>';
      }
    });
}

// ── 내 정보 수정 (profile.html에만 존재) ────────────────────────────────
const profilePortal = document.getElementById("profile-portal");

if (profilePortal) {
  loadPortalMe()
    .then((me) => {
      renderSidebar(me);

      profilePortal.innerHTML = `
        <h3 class="profile-section-title">내 정보</h3>
        <div class="field"><label>성함</label><input type="text" value="${me.name || ""}" disabled></div>
        <div class="field"><label>전화번호</label><input type="tel" value="${me.phone || ""}" disabled></div>
        <div class="field"><label>아이디</label><input type="text" value="${me.login_id || ""}" disabled></div>
        <p class="text-muted" style="margin-top: 8px;">※ 정보 변경 기능은 준비 중입니다. 변경이 필요하시면 상담 문의로 연락해 주세요.</p>
      `;
    })
    .catch(() => {
      if (profilePortal) {
        profilePortal.innerHTML = '<p class="loading">정보를 불러오지 못했습니다. 새로고침해 주세요.</p>';
      }
    });
}
