const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ST = ["To-do", "In-Progress", "Done"];
const BC = { "To-do": "b-todo", "In-Progress": "b-prog", Done: "b-done" };

/* ---------- storage (aman dari error) ---------- */
const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      toast("Penyimpanan penuh atau tidak tersedia", "e");
      return false;
    }
  },
};
let user = null,
  data = { projects: [], tasks: [] },
  view = "dash",
  pid = null,
  flt = { q: "", s: "" },
  editing = null,
  files = [];
const save = () => ls.set("tf_data_" + user.id, data);

/* ---------- util ---------- */
function toast(m, t) {
  const e = document.createElement("div");
  e.className = "toast " + (t || "");
  e.textContent = m;
  $("#toasts").append(e);
  setTimeout(() => e.remove(), 2800);
}
function confirmDel(msg, fn) {
  $("#confMsg").textContent = msg;
  $("#dConf").showModal();
  $("#confOk").onclick = () => {
    $("#dConf").close();
    fn();
  };
}
async function hash(s) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("tf:" + s),
  );
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const dd = (s) => Math.round((new Date(s + "T00:00:00") - today()) / 864e5);
const fmt = (s) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
function dl(s, done) {
  if (!s) return "";
  const n = dd(s);
  const c = !done && n < 0 ? "late" : "";
  const t = done
    ? ""
    : n < 0
      ? ` · terlambat ${-n} hari`
      : n === 0
        ? " · hari ini"
        : n <= 7
          ? ` · ${n} hari lagi`
          : "";
  return `<span class="${c}">${fmt(s)}${t}</span>`;
}
const kb = (n) => (n > 1024 ? (n / 1024).toFixed(0) + " KB" : n + " B");
function setErr(f, errs) {
  f.querySelectorAll("[data-e]").forEach(
    (e) => (e.textContent = errs[e.dataset.e] || ""),
  );
  return !Object.keys(errs).length;
}

/* ---------- auth ---------- */
const tabs = (l) => {
  $("#fLogin").classList.toggle("hide", !l);
  $("#fReg").classList.toggle("hide", l);
  $("#tLogin").className = "btn" + (l ? "" : " g");
  $("#tReg").className = "btn" + (l ? " g" : "");
};
$("#tLogin").onclick = () => tabs(true);
$("#tReg").onclick = () => tabs(false);

$("#fReg").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    u = f.get("u").trim(),
    em = f.get("e").trim().toLowerCase(),
    pw = f.get("pw"),
    pw2 = f.get("pw2");
  const users = ls.get("tf_users", []);
  let m = "";
  if (u.length < 3) m = "Username minimal 3 karakter.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
    m = "Format email tidak valid.";
  else if (pw.length < 6) m = "Password minimal 6 karakter.";
  else if (pw !== pw2) m = "Konfirmasi password tidak sama.";
  else if (
    users.some((x) => x.u.toLowerCase() === u.toLowerCase() || x.e === em)
  )
    m = "Username atau email sudah terdaftar.";
  $("#eReg").textContent = m;
  if (m) return;
  const nu = { id: uid(), u, e: em, h: await hash(pw) };
  users.push(nu);
  if (!ls.set("tf_users", users)) return;
  toast("Akun berhasil dibuat. Silakan masuk.");
  e.target.reset();
  tabs(true);
};
$("#fLogin").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target),
    id = f.get("id").trim().toLowerCase(),
    pw = f.get("pw");
  if (!id || !pw) {
    $("#eLogin").textContent = "Isi username/email dan password.";
    return;
  }
  const u = ls
    .get("tf_users", [])
    .find((x) => x.u.toLowerCase() === id || x.e === id);
  if (!u || u.h !== (await hash(pw))) {
    $("#eLogin").textContent = "Username/email atau password salah.";
    return;
  }
  $("#eLogin").textContent = "";
  ls.set("tf_session", u.id);
  e.target.reset();
  boot();
  toast("Selamat datang, " + u.u + "!");
};
$("#logout").onclick = () => {
  try {
    localStorage.removeItem("tf_session");
  } catch (e) {}
  user = null;
  boot();
  toast("Anda telah keluar");
};

function boot() {
  const sid = ls.get("tf_session", null);
  user = sid ? ls.get("tf_users", []).find((x) => x.id === sid) || null : null;
  $("#auth").classList.toggle("hide", !!user);
  $("#app").classList.toggle("hide", !user);
  if (!user) return;
  data = ls.get("tf_data_" + user.id, { projects: [], tasks: [] });
  $("#who").textContent = user.u;
  view = "dash";
  render();
}

/* ---------- theme ---------- */
function applyTheme(t) {
  if (t) document.documentElement.setAttribute("data-theme", t);
}
applyTheme(ls.get("tf_theme", null));
$("#theme").onclick = () => {
  const cur =
    document.documentElement.getAttribute("data-theme") ||
    (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  const n = cur === "dark" ? "light" : "dark";
  applyTheme(n);
  ls.set("tf_theme", n);
};

/* ---------- nav ---------- */
$("#nDash").onclick = () => {
  view = "dash";
  render();
};
$("#nProj").onclick = () => {
  view = "projects";
  render();
};
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-close]")) e.target.closest("dialog").close();
});

/* ---------- render ---------- */
function render() {
  $("#nDash").classList.toggle("on", view === "dash");
  $("#nProj").classList.toggle("on", view !== "dash");
  const m = $("#main");
  if (view === "dash") m.innerHTML = dash();
  else if (view === "projects") m.innerHTML = projects();
  else m.innerHTML = projectView();
  bind();
}

function dash() {
  const T = data.tasks,
    c = (s) => T.filter((t) => t.status === s).length;
  const soon = T.filter(
    (t) => t.status !== "Done" && t.deadline && dd(t.deadline) <= 7,
  ).sort((a, b) => a.deadline.localeCompare(b.deadline));
  return `<h2>Dashboard</h2>
  <div class="stats">
    <div class="card stat"><b>${data.projects.length}</b><span>Proyek</span></div>
    <div class="card stat"><b>${c("To-do")}</b><span>To-do</span></div>
    <div class="card stat"><b>${c("In-Progress")}</b><span>In-Progress</span></div>
    <div class="card stat"><b>${c("Done")}</b><span>Done</span></div>
  </div>
  <div class="card"><h3>Deadline dekat (≤ 7 hari & terlambat)</h3>
  ${
    soon.length
      ? soon
          .map((t) => {
            const p = data.projects.find((x) => x.id === t.projectId);
            return `<div class="row sp" style="padding:8px 0;border-top:1px solid var(--bd)"><div><button class="link" data-open="${t.projectId}">${esc(t.title)}</button><div class="mu">${esc(p?.name || "")}</div></div><div class="mu">${dl(t.deadline)}</div></div>`;
          })
          .join("")
      : '<div class="empty">Tidak ada tugas yang mendekati deadline 🎉</div>'
  }
  </div>`;
}

function projects() {
  return `<div class="row sp" style="margin-bottom:12px"><h2 style="margin:0">Proyek</h2><button class="btn" id="addProj">+ Proyek baru</button></div>
  ${
    data.projects.length
      ? `<div class="grid">${data.projects
          .map((p) => {
            const t = data.tasks.filter((x) => x.projectId === p.id),
              d = t.filter((x) => x.status === "Done").length;
            return `<div class="card"><div class="row sp"><h3>${esc(p.name)}</h3><span class="badge">${esc(p.status)}</span></div>
  <div class="mu" style="margin-bottom:8px">${esc(p.desc) || "Tanpa deskripsi"}</div>
  <div class="mu">Deadline: ${dl(p.deadline, p.status === "Selesai")}</div><div class="mu">Tugas: ${d}/${t.length} selesai</div>
  <div class="row" style="margin-top:10px"><button class="btn s" data-open="${p.id}">Buka</button><button class="btn g s" data-ep="${p.id}">Ubah</button><button class="btn g s" data-dp="${p.id}">Hapus</button></div></div>`;
          })
          .join("")}</div>`
      : '<div class="empty">Belum ada proyek. Klik “+ Proyek baru” untuk memulai.</div>'
  }`;
}

function projectView() {
  const p = data.projects.find((x) => x.id === pid);
  if (!p) {
    view = "projects";
    return projects();
  }
  let t = data.tasks.filter((x) => x.projectId === pid);
  const all = t.length;
  const q = flt.q.toLowerCase();
  t = t.filter(
    (x) =>
      (!flt.s || x.status === flt.s) &&
      (!q || (x.title + " " + x.desc).toLowerCase().includes(q)),
  );
  return `<button class="link" id="back">← Semua proyek</button>
  <div class="row sp" style="margin:8px 0 4px"><h2 style="margin:0">${esc(p.name)}</h2><span class="badge">${esc(p.status)}</span></div>
  <div class="mu" style="margin-bottom:12px">${esc(p.desc)} · Deadline: ${dl(p.deadline, p.status === "Selesai")}</div>
  <div class="row" style="margin-bottom:12px">
    <input id="q" placeholder="Cari tugas…" value="${esc(flt.q)}" style="flex:1;min-width:140px;width:auto">
    <select id="fs" style="width:auto"><option value="">Semua status</option>${ST.map((s) => `<option ${flt.s === s ? "selected" : ""}>${s}</option>`).join("")}</select>
    <button class="btn" id="addTask">+ Tugas</button>
  </div>
  ${
    !all
      ? '<div class="empty">Proyek ini belum punya tugas. Tambahkan tugas pertama Anda.</div>'
      : `<div class="board">${ST.map((s) => {
          const l = t.filter((x) => x.status === s);
          return `<div class="col" data-col="${s}"><h3>${s}<span class="badge">${l.length}</span></h3>
  ${
    l
      .map(
        (x) => `<div class="task" draggable="true" data-id="${x.id}">
    <b>${esc(x.title)}</b><div class="mu">${esc(x.desc)}</div>
    ${x.deadline ? `<div class="mu">⏰ ${dl(x.deadline, x.status === "Done")}</div>` : ""}
    <div>${(x.att || []).map((a) => (a.type.startsWith("image/") ? `<img class="thumb" src="${a.data}" alt="${esc(a.name)}">` : `<span class="badge" title="${esc(a.name)}">📎 ${esc(a.name.slice(0, 18))}</span> `)).join("")}</div>
    <div class="row" style="margin-top:8px"><button class="btn g s" data-et="${x.id}">Ubah</button><button class="btn g s" data-dt="${x.id}">Hapus</button></div></div>`,
      )
      .join("") || '<div class="mu" style="padding:10px 0">Kosong</div>'
  }</div>`;
        }).join("")}</div>
  ${!t.length ? '<div class="empty" style="margin-top:12px">Tidak ada tugas yang cocok dengan filter.</div>' : ""}`
  }`;
}

/* ---------- bindings ---------- */
function bind() {
  const m = $("#main");
  m.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        pid = b.dataset.open;
        view = "project";
        flt = { q: "", s: "" };
        render();
      }),
  );
  const a = $("#addProj");
  if (a) a.onclick = () => openProj();
  m.querySelectorAll("[data-ep]").forEach(
    (b) =>
      (b.onclick = () =>
        openProj(data.projects.find((p) => p.id === b.dataset.ep))),
  );
  m.querySelectorAll("[data-dp]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = data.projects.find((x) => x.id === b.dataset.dp);
        const n = data.tasks.filter((t) => t.projectId === p.id).length;
        confirmDel(
          `Hapus proyek “${p.name}” beserta ${n} tugas di dalamnya?`,
          () => {
            data.projects = data.projects.filter((x) => x.id !== p.id);
            data.tasks = data.tasks.filter((t) => t.projectId !== p.id);
            save();
            render();
            toast("Proyek dihapus");
          },
        );
      }),
  );
  const bk = $("#back");
  if (bk)
    bk.onclick = () => {
      view = "projects";
      render();
    };
  const at = $("#addTask");
  if (at) at.onclick = () => openTask();
  m.querySelectorAll("[data-et]").forEach(
    (b) =>
      (b.onclick = () =>
        openTask(data.tasks.find((t) => t.id === b.dataset.et))),
  );
  m.querySelectorAll("[data-dt]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = data.tasks.find((x) => x.id === b.dataset.dt);
        confirmDel(`Hapus tugas “${t.title}”?`, () => {
          data.tasks = data.tasks.filter((x) => x.id !== t.id);
          save();
          render();
          toast("Tugas dihapus");
        });
      }),
  );
  const q = $("#q");
  if (q)
    q.oninput = () => {
      flt.q = q.value;
      const pos = q.selectionStart;
      render();
      const n = $("#q");
      n.focus();
      n.setSelectionRange(pos, pos);
    };
  const fs = $("#fs");
  if (fs)
    fs.onchange = () => {
      flt.s = fs.value;
      render();
    };
  /* drag & drop */
  m.querySelectorAll(".task").forEach((el) => {
    el.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", el.dataset.id);
      el.classList.add("drag");
    };
    el.ondragend = () => el.classList.remove("drag");
  });
  m.querySelectorAll(".col").forEach((c) => {
    c.ondragover = (e) => {
      e.preventDefault();
      c.classList.add("over");
    };
    c.ondragleave = () => c.classList.remove("over");
    c.ondrop = (e) => {
      e.preventDefault();
      const t = data.tasks.find(
        (x) => x.id === e.dataTransfer.getData("text/plain"),
      );
      if (t && t.status !== c.dataset.col) {
        t.status = c.dataset.col;
        save();
        toast("Status diubah ke " + t.status);
      }
      render();
    };
  });
}

/* ---------- project form ---------- */
function openProj(p) {
  editing = p || null;
  const f = $("#fProj");
  f.reset();
  setErr(f, {});
  $("#dProjT").textContent = p ? "Ubah proyek" : "Proyek baru";
  if (p) {
    f.name.value = p.name;
    f.desc.value = p.desc;
    f.deadline.value = p.deadline;
    f.status.value = p.status;
  }
  $("#dProj").showModal();
}
$("#fProj").onsubmit = (e) => {
  e.preventDefault();
  const f = e.target,
    er = {},
    name = f.name.value.trim();
  if (name.length < 3) er.name = "Nama minimal 3 karakter.";
  if (!f.deadline.value) er.deadline = "Deadline wajib diisi.";
  if (!setErr(f, er)) return;
  const v = {
    name,
    desc: f.desc.value.trim(),
    deadline: f.deadline.value,
    status: f.status.value,
  };
  if (editing) Object.assign(editing, v);
  else data.projects.push({ id: uid(), ...v });
  if (save()) {
    $("#dProj").close();
    render();
    toast(editing ? "Proyek diperbarui" : "Proyek ditambahkan");
  }
};

/* ---------- task form ---------- */
function attHtml() {
  $("#attList").innerHTML = files
    .map(
      (a, i) =>
        `<div class="row sp mu" style="padding:3px 0"><span>📎 ${esc(a.name)} (${kb(a.size)})</span><button type="button" class="link" data-rm="${i}">hapus</button></div>`,
    )
    .join("");
  $("#attList")
    .querySelectorAll("[data-rm]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          files.splice(+b.dataset.rm, 1);
          attHtml();
        }),
    );
}
function openTask(t) {
  editing = t || null;
  const f = $("#fTask");
  f.reset();
  setErr(f, {});
  files = t ? [...(t.att || [])] : [];
  attHtml();
  $("#dTaskT").textContent = t ? "Ubah tugas" : "Tugas baru";
  if (t) {
    f.title.value = t.title;
    f.desc.value = t.desc;
    f.deadline.value = t.deadline;
    f.status.value = t.status;
  }
  $("#dTask").showModal();
}
$("#fTask").files.onchange = (e) => {
  const er = [];
  [...e.target.files].forEach((file) => {
    if (file.size > 200 * 1024) {
      er.push(`${file.name} melebihi 200 KB`);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      files.push({
        name: file.name,
        type: file.type || "file",
        size: file.size,
        data: r.result,
      });
      attHtml();
    };
    r.readAsDataURL(file);
  });
  setErr($("#fTask"), { files: er.join("; ") });
  e.target.value = "";
};
$("#fTask").onsubmit = (e) => {
  e.preventDefault();
  const f = e.target,
    er = {},
    title = f.title.value.trim();
  if (title.length < 3) er.title = "Judul minimal 3 karakter.";
  if (!f.deadline.value) er.deadline = "Deadline wajib diisi.";
  if (!setErr(f, er)) return;
  const v = {
    title,
    desc: f.desc.value.trim(),
    deadline: f.deadline.value,
    status: f.status.value,
    att: files,
  };
  if (editing) Object.assign(editing, v);
  else data.tasks.push({ id: uid(), projectId: pid, ...v });
  if (save()) {
    $("#dTask").close();
    render();
    toast(editing ? "Tugas diperbarui" : "Tugas ditambahkan");
  }
};

boot();
