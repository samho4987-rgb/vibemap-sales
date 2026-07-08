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
        window.location.href = `product.html?key=${encodeURIComponent(p.key)}`;
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

// ── 카카오 로그인(OAuth) / 이메일 회원가입·로그인 공통 ─────────────────
const KAKAO_REST_API_KEY = "a032304d564482473fd3164c22d2bf1d";
const KAKAO_REDIRECT_URI = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, "")}kakao-callback.html`;

const PORTAL_TOKEN_KEY = "portalToken";
const PORTAL_UNLINKED_KEY = "portalUnlinkedToken";
const PORTAL_NICKNAME_KEY = "portalNickname";

// 로그인/회원가입 페이지인데 이미 로그인되어 있으면 바로 마이페이지로 보낸다.
if (
  (document.getElementById("loginForm") || document.getElementById("signupForm")) &&
  localStorage.getItem(PORTAL_TOKEN_KEY)
) {
  window.location.href = "mypage.html";
}

// 랜딩 페이지 네비게이션이 로그인 상태를 반영하도록.
const navAuthLink = document.getElementById("navAuthLink");
if (navAuthLink && localStorage.getItem(PORTAL_TOKEN_KEY)) {
  navAuthLink.textContent = "마이페이지";
  navAuthLink.href = "mypage.html";
}

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

function goToKakaoAuthorize() {
  const params = new URLSearchParams({
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: KAKAO_REDIRECT_URI,
    response_type: "code",
    scope: "account_email",
  });
  window.location.href = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

// 카카오 버튼은 login.html(로그인), signup.html(회원가입) 두 곳에 있고
// 동작은 전부 동일하게 카카오 인가 화면으로 이동하는 것뿐이다 — 이후 분기는 콜백 페이지가 처리.
// link.html의 kakaoSignupNewBtn은 이미 카카오 인증을 마친 뒤(unlinked 토큰 보유) 신규가입을
// 확정하는 버튼이라 별도 로직(아래 link.html 섹션)에서 처리한다.
["kakaoLoginBtn", "kakaoSignupBtn"].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener("click", goToKakaoAuthorize);
});

// ── 이메일 로그인 페이지 (login.html에만 존재) ──────────────────────────
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const loginBtn = document.getElementById("loginBtn");
  const loginMessage = document.getElementById("loginMessage");

  function setLoginMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    setLoginMessage("로그인 중입니다...", "pending");

    try {
      const res = await fetch(`${API_BASE}/api/portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "INVALID_CREDENTIALS") {
          setLoginMessage("이메일 또는 비밀번호가 올바르지 않습니다.", "error");
        } else if (data.error === "DISABLED") {
          setLoginMessage("정지된 계정입니다. 관리자에게 문의해 주세요.", "error");
        } else {
          setLoginMessage("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        }
        return;
      }

      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      window.location.href = "mypage.html";
    } catch (err) {
      setLoginMessage("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      loginBtn.disabled = false;
    }
  });
}

// ── 이메일 회원가입 페이지 (signup.html에만 존재) ───────────────────────
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const verifyCodeBtn = document.getElementById("verifyCodeBtn");
  const codeField = document.getElementById("codeField");
  const codeStatus = document.getElementById("codeStatus");
  const signupBtn = document.getElementById("signupBtn");
  const signupMessage = document.getElementById("signupMessage");
  const emailInput = document.getElementById("email");

  let emailVerified = false;

  function setCodeStatus(text, type) {
    codeStatus.textContent = text;
    codeStatus.className = "field-hint" + (type ? ` ${type}` : "");
  }

  function setSignupMessage(text, type) {
    signupMessage.textContent = text;
    signupMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  sendCodeBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      setSignupMessage("이메일을 먼저 입력해 주세요.", "error");
      return;
    }

    sendCodeBtn.disabled = true;
    setSignupMessage("인증번호를 발송하는 중입니다...", "pending");

    try {
      const res = await fetch(`${API_BASE}/api/portal/signup/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "EMAIL_ALREADY_REGISTERED") {
          setSignupMessage("이미 가입된 이메일입니다. 로그인해 주세요.", "error");
        } else if (data.error === "INVALID_EMAIL") {
          setSignupMessage("이메일 형식을 확인해 주세요.", "error");
        } else {
          setSignupMessage("인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        }
        return;
      }

      codeField.style.display = "";
      setSignupMessage("인증번호를 발송했습니다. 이메일을 확인해 주세요.", "success");
      emailVerified = false;
    } catch (err) {
      setSignupMessage("인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      sendCodeBtn.disabled = false;
    }
  });

  verifyCodeBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const code = document.getElementById("code").value.trim();
    if (!code) return;

    verifyCodeBtn.disabled = true;
    setCodeStatus("확인 중입니다...", "");

    try {
      const res = await fetch(`${API_BASE}/api/portal/signup/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        emailVerified = false;
        if (data.error === "TOO_MANY_ATTEMPTS") {
          setCodeStatus("시도 횟수를 초과했습니다. 인증번호를 다시 발송해 주세요.", "error");
        } else {
          setCodeStatus("인증번호가 올바르지 않습니다.", "error");
        }
        return;
      }

      emailVerified = true;
      setCodeStatus("이메일 인증이 완료되었습니다.", "success");
    } catch (err) {
      setCodeStatus("확인에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      verifyCodeBtn.disabled = false;
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = emailInput.value.trim();
    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("passwordConfirm").value;
    const agreeTerms = document.getElementById("agreeTerms").checked;

    if (!phone) {
      setSignupMessage("전화번호를 입력해 주세요.", "error");
      return;
    }
    if (!agreeTerms) {
      setSignupMessage("이용약관 및 개인정보처리방침에 동의해 주세요.", "error");
      return;
    }
    if (!emailVerified) {
      setSignupMessage("이메일 인증을 먼저 완료해 주세요.", "error");
      return;
    }
    if (password.length < 8) {
      setSignupMessage("비밀번호는 8자 이상이어야 합니다.", "error");
      return;
    }
    if (password !== passwordConfirm) {
      setSignupMessage("비밀번호가 일치하지 않습니다.", "error");
      return;
    }

    signupBtn.disabled = true;
    setSignupMessage("가입 처리 중입니다...", "pending");

    try {
      const res = await fetch(`${API_BASE}/api/portal/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "EMAIL_NOT_VERIFIED") {
          setSignupMessage("이메일 인증을 먼저 완료해 주세요.", "error");
        } else if (data.error === "EMAIL_ALREADY_REGISTERED") {
          setSignupMessage("이미 가입된 이메일입니다. 로그인해 주세요.", "error");
        } else {
          setSignupMessage("가입에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        }
        return;
      }

      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      window.location.href = "mypage.html";
    } catch (err) {
      setSignupMessage("가입에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      signupBtn.disabled = false;
    }
  });
}

// ── 카카오 로그인 콜백 처리 (kakao-callback.html에만 존재) ──────────────
const callbackMessage = document.getElementById("callbackMessage");

if (callbackMessage) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) {
    callbackMessage.textContent = "카카오 로그인이 취소되었습니다.";
    setTimeout(() => { window.location.href = "login.html"; }, 1500);
  } else {
    fetch(`${API_BASE}/api/portal/kakao/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          callbackMessage.textContent = "카카오 로그인에 실패했습니다. 다시 시도해 주세요.";
          setTimeout(() => { window.location.href = "login.html"; }, 1500);
          return;
        }

        if (data.status === "linked") {
          localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
          localStorage.removeItem(PORTAL_UNLINKED_KEY);
          window.location.href = "mypage.html";
        } else {
          localStorage.setItem(PORTAL_UNLINKED_KEY, data.token);
          localStorage.setItem(PORTAL_NICKNAME_KEY, data.nickname || "");
          window.location.href = "link.html";
        }
      })
      .catch(() => {
        callbackMessage.textContent = "카카오 로그인에 실패했습니다. 다시 시도해 주세요.";
        setTimeout(() => { window.location.href = "login.html"; }, 1500);
      });
  }
}

// ── 계정 연결 / 신규가입 선택 페이지 (link.html에만 존재) ───────────────
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

  const kakaoSignupNewBtn = document.getElementById("kakaoSignupNewBtn");
  if (kakaoSignupNewBtn) {
    const newAccountMessage = document.getElementById("newAccountMessage");
    function setNewAccountMessage(text, type) {
      newAccountMessage.textContent = text;
      newAccountMessage.className = "form-message" + (type ? ` ${type}` : "");
    }

    kakaoSignupNewBtn.addEventListener("click", async () => {
      const phone = document.getElementById("phone").value.trim();
      if (!phone) {
        setNewAccountMessage("전화번호를 입력해 주세요.", "error");
        return;
      }

      kakaoSignupNewBtn.disabled = true;
      setNewAccountMessage("가입 처리 중입니다...", "pending");

      try {
        const res = await fetch(`${API_BASE}/api/portal/kakao/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${unlinkedToken}`,
          },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();

        if (!res.ok) {
          setNewAccountMessage("가입에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
          return;
        }

        localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
        localStorage.removeItem(PORTAL_UNLINKED_KEY);
        localStorage.removeItem(PORTAL_NICKNAME_KEY);
        window.location.href = "mypage.html";
      } catch (err) {
        setNewAccountMessage("가입에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
      } finally {
        kakaoSignupNewBtn.disabled = false;
      }
    });
  }
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
        <form id="profileForm">
          <div class="field"><label for="profileName">성함</label><input type="text" id="profileName" value="${me.name || ""}"></div>
          <div class="field"><label for="profilePhone">전화번호</label><input type="tel" id="profilePhone" value="${me.phone || ""}"></div>
          <div class="field"><label>아이디</label><input type="text" value="${me.login_id || ""}" disabled></div>
          <div class="field"><label for="profileBrokerRegNumber">중개업등록번호</label><input type="text" id="profileBrokerRegNumber" value="${me.broker_reg_number || ""}" placeholder="예: 12345-2026-00001"></div>
          <div class="field"><label for="profileNaverListingId">네이버 매물 아이디</label><input type="text" id="profileNaverListingId" value="${me.naver_listing_id || ""}"></div>
          <p id="profileMessage" class="form-message" role="status"></p>
          <button type="submit" id="profileSaveBtn" class="btn-primary" style="padding: 12px 24px;">변경사항 저장</button>
        </form>
      `;

      const profileForm = document.getElementById("profileForm");
      const profileMessage = document.getElementById("profileMessage");
      const profileSaveBtn = document.getElementById("profileSaveBtn");

      function setProfileMessage(text, type) {
        profileMessage.textContent = text;
        profileMessage.className = "form-message" + (type ? ` ${type}` : "");
      }

      profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        profileSaveBtn.disabled = true;
        setProfileMessage("저장하는 중입니다...", "pending");

        try {
          const res = await portalFetch("/api/portal/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: document.getElementById("profileName").value.trim(),
              phone: document.getElementById("profilePhone").value.trim(),
              broker_reg_number: document.getElementById("profileBrokerRegNumber").value.trim(),
              naver_listing_id: document.getElementById("profileNaverListingId").value.trim(),
            }),
          });

          if (!res.ok) throw new Error("REQUEST_FAILED");

          const updated = await res.json();
          renderSidebar(updated);
          setProfileMessage("저장되었습니다.", "success");
        } catch (err) {
          setProfileMessage("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        } finally {
          profileSaveBtn.disabled = false;
        }
      });
    })
    .catch(() => {
      if (profilePortal) {
        profilePortal.innerHTML = '<p class="loading">정보를 불러오지 못했습니다. 새로고침해 주세요.</p>';
      }
    });
}

// ── 사이트 푸터 (footer id="siteFooter"가 있는 모든 페이지) ─────────────
const siteFooter = document.getElementById("siteFooter");

if (siteFooter) {
  // TODO: 소재지/사업자등록번호/통신판매업신고번호는 더미값 — 실제 값으로 교체 필요
  siteFooter.innerHTML = `
    <div class="container footer-inner">
      <img src="assets/logo.png" alt="바이브 프롭테크" class="footer-logo" onerror="this.style.display='none'">
      <div class="footer-info">
        <p>소재지: 서울특별시 강남구 테헤란로 123, 4층 (더미 주소 — 교체 필요)</p>
        <p>사업자등록번호: 000-00-00000 (더미) · 통신판매업신고번호: 제2026-서울강남-0000호 (더미)</p>
        <p>대표자: 이정훈 · 개인정보보호책임자: 이정훈</p>
        <p class="footer-copy">© 2026 VIBE PropTech. All Rights Reserved. 상담문의: info@example.com</p>
      </div>
    </div>
  `;
}

// ── 무료 체험 상품 정보 (products.json과 별개, 코드에 직접 정의) ─────────
const TRIAL_PRODUCTS = {
  trial_map: {
    name: "바이브 지도 체험판",
    tagline: "3일간 무료로 체험해보세요",
    detail: [
      "정식판과 동일한 지도 기반 매물 뷰어를 체험할 수 있습니다.",
      "매물 자동 수집(크롤링) 및 고급 분석 기능은 체험판에서 제한됩니다.",
      "체험 기간은 신청 후 3일간이며, 이후 자동으로 기능이 제한됩니다.",
      "체험 중 정식 이용을 원하시면 언제든 구매하실 수 있습니다.",
    ],
    downloadUrl: "https://samho4987-rgb.github.io/vibemap-releases/",
    downloadLabel: "지금 다운로드",
  },
  trial_news: {
    name: "실시간 뉴스 수집 프로그램",
    tagline: "출시 준비 중 — 지금 신청하시면 가장 먼저 안내드립니다",
    detail: [
      "키워드 기반으로 실시간 뉴스를 자동 수집하는 프로그램입니다.",
      "현재 개발 중이며, 출시되는 대로 신청자분들께 3일 무료 체험을 가장 먼저 안내드립니다.",
    ],
    downloadUrl: null,
  },
};

// ── 상품 상세 페이지 (product.html에만 존재) ────────────────────────────
const productDetail = document.getElementById("product-detail");

if (productDetail) {
  const key = new URLSearchParams(window.location.search).get("key") || "";

  loadProducts().then(() => {
    const product = products.find((p) => p.key === key);
    if (!product) {
      productDetail.innerHTML = '<p class="loading">존재하지 않는 상품입니다. <a href="index.html">홈으로 돌아가기</a></p>';
      return;
    }

    const pending = product.status === "pending";
    const detailItems = (product.detail || []).map((d) => `<li>${d}</li>`).join("");

    productDetail.innerHTML = `
      <a href="index.html#products" class="back-link">← 상품 목록으로</a>
      <div class="product-detail-header">
        <h1>${product.name}</h1>
        <div class="price-tag">${product.price}</div>
        <p style="color:var(--muted);">${product.description}</p>
      </div>
      <ul class="product-detail-list">${detailItems}</ul>
      <button type="button" id="openPurchaseBtn" class="btn-primary" style="width:100%;">
        ${pending ? "출시 알림 신청" : "구매하기"}
      </button>
    `;

    document.getElementById("openPurchaseBtn").addEventListener("click", () => {
      openPurchaseModal(product);
    });
  }).catch(() => {
    productDetail.innerHTML = '<p class="loading">상품 정보를 불러오지 못했습니다. 새로고침해 주세요.</p>';
  });
}

// ── 구매 모달 (product.html에만 존재) ───────────────────────────────────
const purchaseModalOverlay = document.getElementById("purchaseModalOverlay");

if (purchaseModalOverlay) {
  // TODO: 실제 입금 계좌로 교체
  const BANK_INFO = {
    bank: "OO은행",
    accountNumber: "000-000000-00-000",
    holder: "바이브프롭테크",
  };

  const purchaseForm = document.getElementById("purchaseForm");
  const purchaseSubmitBtn = document.getElementById("purchaseSubmitBtn");
  const purchaseMessage = document.getElementById("purchaseMessage");
  let currentProduct = null;

  function setPurchaseMessage(text, type) {
    purchaseMessage.textContent = text;
    purchaseMessage.className = "form-message" + (type ? ` ${type}` : "");
  }

  window.openPurchaseModal = function (product) {
    currentProduct = product;
    const pending = product.status === "pending";
    document.getElementById("purchaseModalTitle").textContent = pending ? "출시 알림 신청" : "프로그램 구매";
    document.getElementById("purchaseProductName").textContent = product.name;
    document.getElementById("purchasePeriod").textContent = pending ? "-" : (product.period || "1개월");
    document.getElementById("purchasePrice").textContent = product.price;
    document.getElementById("purchaseBankName").textContent = BANK_INFO.bank;
    document.getElementById("purchaseBankAccount").textContent = BANK_INFO.accountNumber;
    document.getElementById("purchaseBankHolder").textContent = BANK_INFO.holder;
    document.getElementById("purchaseSubmitBtn").textContent = pending ? "신청하기" : "구매하기";
    setPurchaseMessage("", "");
    purchaseForm.reset();
    purchaseModalOverlay.style.display = "flex";
  };

  function closePurchaseModal() {
    purchaseModalOverlay.style.display = "none";
  }

  document.getElementById("purchaseModalClose").addEventListener("click", closePurchaseModal);
  document.getElementById("purchaseCancelBtn").addEventListener("click", closePurchaseModal);
  purchaseModalOverlay.addEventListener("click", (e) => {
    if (e.target === purchaseModalOverlay) closePurchaseModal();
  });

  purchaseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentProduct) return;

    const name = document.getElementById("purchaseName").value.trim();
    const phone = document.getElementById("purchasePhone").value.trim();

    purchaseSubmitBtn.disabled = true;
    setPurchaseMessage("접수 중입니다...", "pending");

    try {
      const res = await fetch(`${API_BASE}/api/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email: "", product: currentProduct.key, memo: "" }),
      });

      if (!res.ok) throw new Error("REQUEST_FAILED");

      setPurchaseMessage("접수되었습니다. 입금 확인 후 순차적으로 안내드립니다.", "success");
      purchaseSubmitBtn.style.display = "none";
      document.getElementById("purchaseCancelBtn").textContent = "닫기";
    } catch (err) {
      setPurchaseMessage("접수에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      purchaseSubmitBtn.disabled = false;
    }
  });
}

// ── 무료 체험 신청 페이지 (trial.html에만 존재) ─────────────────────────
const trialDetail = document.getElementById("trial-detail");

if (trialDetail) {
  const key = new URLSearchParams(window.location.search).get("key") || "";
  const trial = TRIAL_PRODUCTS[key];

  if (!trial) {
    trialDetail.innerHTML = '<p class="loading">존재하지 않는 체험판입니다. <a href="index.html">홈으로 돌아가기</a></p>';
  } else {
    const detailItems = trial.detail.map((d) => `<li>${d}</li>`).join("");
    trialDetail.innerHTML = `
      <a href="index.html" class="back-link">← 홈으로</a>
      <div class="product-detail-header">
        <h1>${trial.name}</h1>
        <p style="color:var(--accent); font-weight:700;">${trial.tagline}</p>
      </div>
      <ul class="product-detail-list">${detailItems}</ul>
      <div class="form-box" id="trialFormBox">
        <form id="trialForm">
          <div class="field"><label for="trialName">이름</label><input type="text" id="trialName" required placeholder="이름을 입력하세요"></div>
          <div class="field"><label for="trialPhone">휴대폰 번호</label><input type="tel" id="trialPhone" required placeholder="010-1234-5678"></div>
          <div class="field"><label for="trialEmail">이메일 (선택)</label><input type="email" id="trialEmail" placeholder="example@naver.com"></div>
          <label class="checkbox-row"><input type="checkbox" id="trialAgree" required> 개인정보 수집 및 이용에 동의합니다 (필수)</label>
          <p id="trialMessage" class="form-message" role="status"></p>
          <button type="submit" id="trialSubmitBtn" class="btn-submit">체험 신청하기</button>
        </form>
      </div>
    `;

    const trialForm = document.getElementById("trialForm");
    const trialSubmitBtn = document.getElementById("trialSubmitBtn");
    const trialMessage = document.getElementById("trialMessage");

    function setTrialMessage(text, type) {
      trialMessage.textContent = text;
      trialMessage.className = "form-message" + (type ? ` ${type}` : "");
    }

    trialForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("trialName").value.trim();
      const phone = document.getElementById("trialPhone").value.trim();
      const email = document.getElementById("trialEmail").value.trim();

      trialSubmitBtn.disabled = true;
      setTrialMessage("접수 중입니다...", "pending");

      try {
        const res = await fetch(`${API_BASE}/api/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, email, product: key, memo: "체험 신청" }),
        });

        if (!res.ok) throw new Error("REQUEST_FAILED");

        const box = document.getElementById("trialFormBox");
        if (trial.downloadUrl) {
          box.innerHTML = `
            <p class="form-message success" style="margin-bottom:16px;">체험 신청이 접수되었습니다!</p>
            <a href="${trial.downloadUrl}" target="_blank" rel="noopener" class="btn-submit" style="display:block; text-align:center; text-decoration:none;">${trial.downloadLabel}</a>
          `;
        } else {
          box.innerHTML = `<p class="form-message success">신청이 접수되었습니다. 출시되면 등록하신 연락처로 가장 먼저 안내드립니다.</p>`;
        }
      } catch (err) {
        setTrialMessage("접수에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        trialSubmitBtn.disabled = false;
      }
    });
  }
}
