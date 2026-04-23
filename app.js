let user = localStorage.getItem("user");

if (user) showApp();

async function login() {
  user = document.getElementById("username").value;
  localStorage.setItem("user", user);
  showApp();

  await requestPermission();
  await saveToken();
}

function showApp() {
  document.getElementById("loginDiv").style.display = "none";
  document.getElementById("appDiv").style.display = "block";
  document.getElementById("welcome").innerText = "Welcome " + user;
  loadTasks();
}

// 🔔 Request notification permission
async function requestPermission() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Notification permission denied");
  }
}

// 🔥 Get device token & save
async function saveToken() {
  try {
    const token = await messaging.getToken({
      vapidKey: "BJEO1paZuTfQ_yTHN177xgI76o7MzSnNVM9VdGB7IBgCxodaiPfxaawjJwBnVCg0I1nDMHZErTIKtYDUXQSpD0k"
    });

    console.log("TOKEN:", token);

    await db.collection("users").doc(user).set({
      token: token
    });

  } catch (err) {
    console.log(err);
  }
}

// ➕ Add Task
async function addTask() {
  const title = document.getElementById("taskTitle").value;
  const time = document.getElementById("taskTime").value;

  if (!title || !time) return;

  await db.collection("tasks").add({
    user,
    title,
    time
  });

  loadTasks();
}

// 📋 Load Tasks
async function loadTasks() {
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  const snapshot = await db.collection("tasks")
    .where("user", "==", user)
    .get();

  snapshot.forEach(doc => {
    const task = doc.data();

    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between";

    li.innerHTML = `
      ${task.title} - ${task.time}
      <button onclick="deleteTask('${doc.id}')" class="btn btn-danger btn-sm">Del</button>
    `;

    list.appendChild(li);
  });
}