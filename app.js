import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCOra49WkUomU1PkNPxpeY1Iu5gmtP--fo",
  authDomain: "task-streak-app-8f4b1.firebaseapp.com",
  projectId: "task-streak-app-8f4b1",
  storageBucket: "task-streak-app-8f4b1.firebasestorage.app",
  messagingSenderId: "801712759288",
  appId: "1:801712759288:web:2b741ac0851ac33e62f60d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let allTasks = [];
let editingTaskId = null;
let isSignup = false;
let unsubscribeTasks = null;

const today = () => new Date().toISOString().slice(0, 10);

function formatReadableDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTime(time24) {
  if (!time24) return "No time";
  const [hour, minute] = time24.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function timeToMinutes(time24) {
  if (!time24) return 99999;
  const [hour, minute] = time24.split(":").map(Number);
  return hour * 60 + minute;
}

function completionKey(dateStr) {
  return `done_${dateStr}`;
}

$("currentDateText").innerText = formatReadableDate(today());
$("selectedDate").value = today();
$("taskDate").value = today();

// ---------- AUTH UI ----------
$("signupTab").onclick = () => {
  isSignup = true;
  $("signupTab").classList.add("active");
  $("loginTab").classList.remove("active");
  $("usernameBox").classList.remove("hidden");
  $("authBtn").innerText = "Signup";
  $("authMsg").innerText = "";
};

$("loginTab").onclick = () => {
  isSignup = false;
  $("loginTab").classList.add("active");
  $("signupTab").classList.remove("active");
  $("usernameBox").classList.add("hidden");
  $("authBtn").innerText = "Login";
  $("authMsg").innerText = "";
};

$("authBtn").onclick = async () => {
  const email = $("email").value.trim();
  const pass = $("password").value.trim();
  const username = $("username").value.trim();

  try {
    $("authMsg").innerText = "";

    if (!email || !pass) {
      $("authMsg").innerText = "Email and password required";
      return;
    }

    if (isSignup) {
      if (!username) {
        $("authMsg").innerText = "Username required";
        return;
      }

      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: username });

      await setDoc(doc(db, "users", res.user.uid), {
        username,
        email,
        streak: 0,
        lastCompletedDate: "",
        createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (error) {
    $("authMsg").innerText = error.message;
  }
};

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    $("authPage").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("showUsername").innerText = user.displayName || "User";
    $("showEmail").innerText = user.email || "";
    $("avatar").innerText = (user.displayName || "U").charAt(0).toUpperCase();

    listenTasks();
    await loadUserStats();
  } else {
    if (unsubscribeTasks) unsubscribeTasks();
    $("authPage").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
  }
});

// ---------- MODAL ----------
$("openModalBtn").onclick = () => openModal();
$("closeModalBtn").onclick = () => closeModal();
$("cancelBtn").onclick = () => closeModal();

$("taskModal").onclick = (e) => {
  if (e.target.id === "taskModal") closeModal();
};

function openModal(task = null) {
  editingTaskId = task?.id || null;

  $("modalTitle").innerText = editingTaskId ? "Update Task" : "Add Task";
  $("taskTitle").value = task?.title || "";
  $("taskCategory").value = task?.category || "DSA";
  $("taskTime").value = task?.time || "";
  $("taskDate").value = task?.startDate || $("selectedDate").value || today();
  $("taskNote").value = task?.note || "";
  $("taskMsg").innerText = "";

  $("taskModal").classList.remove("hidden");
}

function closeModal() {
  editingTaskId = null;
  $("taskModal").classList.add("hidden");
}

// ---------- SAVE TASK ----------
$("saveTaskBtn").onclick = async () => {
  const title = $("taskTitle").value.trim();
  const category = $("taskCategory").value;
  const time = $("taskTime").value;
  const startDate = $("taskDate").value;
  const note = $("taskNote").value.trim();

  if (!currentUser) return alert("Login first");
  if (!title) return $("taskMsg").innerText = "Task name required";
  if (!time) return $("taskMsg").innerText = "Task time required";
  if (!startDate) return $("taskMsg").innerText = "Task date required";

  $("saveTaskBtn").disabled = true;
  $("saveTaskBtn").innerText = "Saving...";

  try {
    const taskData = {
      title,
      category,
      time,
      startDate,
      note,
      updatedAt: serverTimestamp()
    };

    if (editingTaskId) {
      await updateDoc(doc(db, "users", currentUser.uid, "tasks", editingTaskId), taskData);
    } else {
      await addDoc(collection(db, "users", currentUser.uid, "tasks"), {
        ...taskData,
        createdAt: serverTimestamp()
      });
    }

    closeModal();
  } catch (error) {
    $("taskMsg").innerText = error.message;
  } finally {
    $("saveTaskBtn").disabled = false;
    $("saveTaskBtn").innerText = "Save Task";
  }
};

// ---------- TASK LIST ----------
function listenTasks() {
  if (unsubscribeTasks) unsubscribeTasks();

  unsubscribeTasks = onSnapshot(
    collection(db, "users", currentUser.uid, "tasks"),
    (snapshot) => {
      allTasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTasks();
      updateScore();
    },
    (error) => {
      $("taskList").innerHTML = `<div class="empty">Firestore error: ${escapeHtml(error.message)}</div>`;
    }
  );
}

$("selectedDate").onchange = () => {
  $("currentDateText").innerText = formatReadableDate($("selectedDate").value);
  renderTasks();
  updateScore();
};

$("filter").onchange = () => {
  renderTasks();
};

function getVisibleTasks() {
  const selectedDate = $("selectedDate").value;
  const filter = $("filter").value;
  const key = completionKey(selectedDate);

  let tasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= selectedDate;
  });

  if (filter === "done") tasks = tasks.filter((task) => task[key]);
  if (filter === "pending") tasks = tasks.filter((task) => !task[key]);

  return tasks.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function renderTasks() {
  const selectedDate = $("selectedDate").value;
  const key = completionKey(selectedDate);
  const tasks = getVisibleTasks();

  if (!tasks.length) {
    $("taskList").innerHTML = `
      <div class="empty">
        No tasks found for this date. Click <b>+ Add Task</b> to create your routine.
      </div>
    `;
    return;
  }

  $("taskList").innerHTML = tasks.map((task) => {
    const checked = task[key] ? "checked" : "";
    const doneClass = task[key] ? "task-done" : "";

    return `
      <div class="task-card ${doneClass}">
        <input class="task-check" type="checkbox" ${checked}
          onchange="toggleTask('${task.id}', this.checked)">

        <div class="task-main">
          <h3>${escapeHtml(task.title)}</h3>
          <div class="task-meta">
            <span class="badge">${escapeHtml(task.category || "Other")}</span>
            <span class="time-badge">⏰ ${formatTime(task.time)}</span>
            <span class="date-badge">📅 From ${escapeHtml(task.startDate || selectedDate)}</span>
          </div>
          ${task.note ? `<div class="task-note">📝 ${escapeHtml(task.note)}</div>` : ""}
        </div>

        <div class="actions">
          <button class="icon-btn" onclick="editTask('${task.id}')">Edit</button>
          <button class="icon-btn delete-btn" onclick="deleteTaskNow('${task.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleTask = async (id, checked) => {
  const selectedDate = $("selectedDate").value;
  const key = completionKey(selectedDate);

  try {
    await updateDoc(doc(db, "users", currentUser.uid, "tasks", id), {
      [key]: checked,
      updatedAt: serverTimestamp()
    });

    setTimeout(updateStreakIfNeeded, 300);
  } catch (error) {
    alert(error.message);
  }
};

window.editTask = (id) => {
  const task = allTasks.find((t) => t.id === id);
  if (task) openModal(task);
};

window.deleteTaskNow = async (id) => {
  const ok = confirm("Delete this task permanently?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "tasks", id));
  } catch (error) {
    alert(error.message);
  }
};

// ---------- SCORE ----------
function updateScore() {
  const selectedDate = $("selectedDate").value;
  const key = completionKey(selectedDate);

  const tasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= selectedDate;
  });

  const total = tasks.length;
  const done = tasks.filter((task) => task[key]).length;
  const pending = total - done;
  const score = total ? Math.round((done / total) * 100) : 0;

  $("dailyScore").innerText = score;
  $("scoreBar").style.width = `${score}%`;
  $("doneCount").innerText = done;
  $("totalCount").innerText = total;
  $("pendingCount").innerText = pending;
}

// ---------- STREAK ----------
async function loadUserStats() {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    $("streakCount").innerText = snap.data().streak || 0;
  }
}

async function updateStreakIfNeeded() {
  const selectedDate = $("selectedDate").value;

  // Streak should update only for today, not old/future dates.
  if (selectedDate !== today()) return;

  const key = completionKey(today());
  const todayTasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= today();
  });

  if (!todayTasks.length) return;
  if (!todayTasks.every((task) => task[key])) return;

  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};

  if (data.lastCompletedDate === today()) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = data.lastCompletedDate === yesterdayStr
    ? (data.streak || 0) + 1
    : 1;

  await updateDoc(userRef, {
    streak: newStreak,
    lastCompletedDate: today()
  });

  $("streakCount").innerText = newStreak;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}
