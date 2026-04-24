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

// Your Firebase Config
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

// Set initial date display
if ($("currentDateText")) $("currentDateText").innerText = formatReadableDate(today());
if ($("selectedDate")) $("selectedDate").value = today();
if ($("taskDate")) $("taskDate").value = today();

// ---------- AUTH UI ----------
if ($("signupTab")) {
  $("signupTab").onclick = () => {
    isSignup = true;
    $("signupTab").classList.add("active");
    $("loginTab").classList.remove("active");
    $("usernameBox").classList.remove("hidden");
    $("authBtn").innerText = "Signup";
    $("authMsg").innerText = "";
  };
}

if ($("loginTab")) {
  $("loginTab").onclick = () => {
    isSignup = false;
    $("loginTab").classList.add("active");
    $("signupTab").classList.remove("active");
    $("usernameBox").classList.add("hidden");
    $("authBtn").innerText = "Login";
    $("authMsg").innerText = "";
  };
}

if ($("authBtn")) {
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
}

if ($("logoutBtn")) {
  $("logoutBtn").onclick = () => signOut(auth);
}

// Auth State Handler
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    if ($("authPage")) $("authPage").classList.add("hidden");
    if ($("dashboard")) $("dashboard").classList.remove("hidden");

    if ($("showUsername")) $("showUsername").innerText = user.displayName || "Adiii";
    if ($("showEmail")) $("showEmail").innerText = user.email || "";
    if ($("avatar")) $("avatar").innerText = (user.displayName || "U").charAt(0).toUpperCase();

    listenTasks();
    await loadUserStats();
  } else {
    if (unsubscribeTasks) unsubscribeTasks();
    if ($("authPage")) $("authPage").classList.remove("hidden");
    if ($("dashboard")) $("dashboard").classList.add("hidden");
  }
});

// ---------- MODAL ----------
if ($("openModalBtn")) $("openModalBtn").onclick = () => openModal();
if ($("closeModalBtn")) $("closeModalBtn").onclick = () => closeModal();
if ($("cancelBtn")) $("cancelBtn").onclick = () => closeModal();

if ($("taskModal")) {
  $("taskModal").onclick = (e) => {
    if (e.target.id === "taskModal") closeModal();
  };
}

function openModal(task = null) {
  editingTaskId = task?.id || null;

  if ($("modalTitle")) $("modalTitle").innerText = editingTaskId ? "Update Task" : "Add Task";
  if ($("taskTitle")) $("taskTitle").value = task?.title || "";
  if ($("taskCategory")) $("taskCategory").value = task?.category || "DSA";
  if ($("taskTime")) $("taskTime").value = task?.time || "";
  if ($("taskDate")) $("taskDate").value = task?.startDate || ($("selectedDate") ? $("selectedDate").value : today());
  if ($("taskNote")) $("taskNote").value = task?.note || "";
  if ($("taskMsg")) $("taskMsg").innerText = "";

  if ($("taskModal")) $("taskModal").classList.remove("hidden");
}

function closeModal() {
  editingTaskId = null;
  if ($("taskModal")) $("taskModal").classList.add("hidden");
}

// ---------- SAVE TASK ----------
if ($("saveTaskBtn")) {
  $("saveTaskBtn").onclick = async () => {
    const title = $("taskTitle").value.trim();
    const category = $("taskCategory").value;
    const time = $("taskTime").value;
    const startDate = $("taskDate").value;
    const note = $("taskNote").value.trim();

    if (!currentUser) return alert("Login first");
    if (!title) {
      if ($("taskMsg")) $("taskMsg").innerText = "Task name required";
      return;
    }
    if (!time) {
      if ($("taskMsg")) $("taskMsg").innerText = "Task time required";
      return;
    }
    if (!startDate) {
      if ($("taskMsg")) $("taskMsg").innerText = "Task date required";
      return;
    }

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
      if ($("taskMsg")) $("taskMsg").innerText = error.message;
    } finally {
      $("saveTaskBtn").disabled = false;
      $("saveTaskBtn").innerText = "Save Task";
    }
  };
}

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
      if ($("taskList")) $("taskList").innerHTML = `<div class="empty">Firestore error: ${escapeHtml(error.message)}</div>`;
    }
  );
}

if ($("selectedDate")) {
  $("selectedDate").onchange = () => {
    if ($("currentDateText")) $("currentDateText").innerText = formatReadableDate($("selectedDate").value);
    renderTasks();
    updateScore();
  };
}

if ($("filter")) {
  $("filter").onchange = () => {
    renderTasks();
  };
}

function getVisibleTasks() {
  const selectedDate = $("selectedDate") ? $("selectedDate").value : today();
  const filter = $("filter") ? $("filter").value : "all";
  const key = completionKey(selectedDate);

  let tasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= selectedDate;
  });

  if (filter === "done") tasks = tasks.filter((task) => task[key] === true);
  if (filter === "pending") tasks = tasks.filter((task) => task[key] !== true);

  return tasks.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function renderTasks() {
  const selectedDate = $("selectedDate") ? $("selectedDate").value : today();
  const key = completionKey(selectedDate);
  const tasks = getVisibleTasks();

  if (!tasks.length) {
    if ($("taskList")) {
      $("taskList").innerHTML = `
        <div class="empty">
          No tasks found for this date. Click <b>+ Add Task</b> to create your routine.
        </div>
      `;
    }
    return;
  }

  if ($("taskList")) {
    $("taskList").innerHTML = tasks.map((task) => {
      // IMPORTANT FIX: Properly check if the task is completed for the selected date
      const isChecked = task[key] === true;
      const checkedAttr = isChecked ? "checked" : "";
      const doneClass = isChecked ? "task-done" : "";

      return `
        <div class="task-card ${doneClass}" data-task-id="${task.id}">
          <input class="task-check" type="checkbox" ${checkedAttr}
            onchange="window.toggleTask('${task.id}', this.checked, '${selectedDate}')">
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
            <button class="icon-btn" onclick="window.editTask('${task.id}')">Edit</button>
            <button class="icon-btn delete-btn" onclick="window.deleteTaskNow('${task.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }
}

// FIXED: toggleTask function properly bound to window
window.toggleTask = async (taskId, isChecked, selectedDate) => {
  if (!currentUser) {
    console.error("No user logged in");
    return;
  }

  // Use the provided selectedDate or get from DOM
  const date = selectedDate || ($("selectedDate") ? $("selectedDate").value : today());
  const key = completionKey(date);

  try {
    // Update the task's completion status for the selected date
    await updateDoc(doc(db, "users", currentUser.uid, "tasks", taskId), {
      [key]: isChecked === true || isChecked === "true",
      updatedAt: serverTimestamp()
    });
    
    // Force immediate UI update
    renderTasks();
    updateScore();
    
    // Only update streak for today's date
    if (date === today()) {
      setTimeout(() => updateStreakIfNeeded(), 200);
    }
  } catch (error) {
    console.error("Error toggling task:", error);
    alert("Failed to update task: " + error.message);
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
  const selectedDate = $("selectedDate") ? $("selectedDate").value : today();
  const key = completionKey(selectedDate);

  const tasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= selectedDate;
  });

  const total = tasks.length;
  const done = tasks.filter((task) => task[key] === true).length;
  const pending = total - done;
  const score = total ? Math.round((done / total) * 100) : 0;

  if ($("dailyScore")) $("dailyScore").innerText = score;
  if ($("scoreBar")) $("scoreBar").style.width = `${score}%`;
  if ($("doneCount")) $("doneCount").innerText = done;
  if ($("totalCount")) $("totalCount").innerText = total;
  if ($("pendingCount")) $("pendingCount").innerText = pending;
}

// ---------- STREAK ----------
async function loadUserStats() {
  if (!currentUser) return;
  
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists() && $("streakCount")) {
    $("streakCount").innerText = snap.data().streak || 0;
  }
}

async function updateStreakIfNeeded() {
  if (!currentUser) return;
  
  const todayDate = today();
  const key = completionKey(todayDate);
  
  // Get today's active tasks
  const todayTasks = allTasks.filter((task) => {
    return !task.startDate || task.startDate <= todayDate;
  });

  // If no tasks for today, don't update streak
  if (todayTasks.length === 0) return;
  
  // Check if all today's tasks are completed
  const allCompleted = todayTasks.every((task) => task[key] === true);
  
  if (!allCompleted) return;

  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};

  // Don't update streak twice on the same day
  if (data.lastCompletedDate === todayDate) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = 1;
  if (data.lastCompletedDate === yesterdayStr) {
    newStreak = (data.streak || 0) + 1;
  }

  await updateDoc(userRef, {
    streak: newStreak,
    lastCompletedDate: todayDate
  });

  if ($("streakCount")) $("streakCount").innerText = newStreak;
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