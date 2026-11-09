
const KEY = "edusphere_data";

const emptyDB = () => ({
  students: [],
  attendance: {},
  marks: [],
  fees: [],
  assignments: [],
  events: [],
  activity: [],
  notifications: []
});

function loadDB() {
  try {
    return { ...emptyDB(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return emptyDB();
  }
}

let db = loadDB();
let submitAction = null;
let courseChart = null;
let attendanceChart = null;

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(Number(value) || 0);

const uid = prefix => prefix + "-" + Date.now().toString(36).toUpperCase() +
  "-" + Math.random().toString(36).slice(2, 5).toUpperCase();

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function student(id) {
  return db.students.find(s => s.id === id);
}

function initials(name) {
  return (name || "S").trim().split(/\s+/).slice(0, 2)
    .map(x => x[0]).join("").toUpperCase();
}

function dateText(date) {
  return date ? new Date(date + "T00:00:00")
    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

function log(message) {
  db.activity.unshift({
    id: uid("LOG"),
    message,
    time: new Date().toISOString()
  });
  db.activity = db.activity.slice(0, 100);
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2500);

  db.notifications.unshift({ message, time: new Date().toISOString() });
  db.notifications = db.notifications.slice(0, 30);
  renderNotifications();
  save();
}

function studentInfo(s) {
  return `<div class="student">
    ${s.photo
      ? `<img class="avatar" src="${s.photo}" alt="">`
      : `<span class="avatar">${esc(initials(s.name))}</span>`}
    <div><strong>${esc(s.name)}</strong><small>${esc(s.email)}</small></div>
  </div>`;
}

function grade(percent) {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
}

// NAVIGATION
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("active", p.id === "page-" + name);
  });

  document.querySelectorAll("[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === name);
  });

  $("page-title").textContent =
    document.querySelector(`[data-page="${name}"]`)?.textContent.trim() || "Dashboard";

  $("sidebar").classList.remove("open");

  const renderers = {
    dashboard,
    students: renderStudents,
    attendance: renderAttendance,
    marks: renderMarks,
    fees: renderFees,
    assignments: renderAssignments,
    calendar: renderEvents,
    activity: renderActivity
  };

  renderers[name]?.();
}

document.querySelectorAll("[data-page]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    history.replaceState(null, "", "#" + link.dataset.page);
    showPage(link.dataset.page);
  });
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  if (!link.dataset.page) {
    link.addEventListener("click", e => {
      const name = link.getAttribute("href").slice(1);
      if ($("page-" + name)) {
        e.preventDefault();
        showPage(name);
      }
    });
  }
});

$("menu").onclick = () => $("sidebar").classList.toggle("open");

// MODAL
function openModal(title, fields, callback, eyebrow = "DETAILS") {
  $("modal-heading").textContent = title;
  $("modal-eyebrow").textContent = eyebrow;
  $("modal-fields").innerHTML = fields;
  submitAction = callback;
  $("backdrop").classList.add("show");
}

function closeModal() {
  $("backdrop").classList.remove("show");
  submitAction = null;
}

$("close-modal").onclick = closeModal;
$("cancel-modal").onclick = closeModal;

$("backdrop").addEventListener("click", e => {
  if (e.target === $("backdrop")) closeModal();
});

$("modal-form").addEventListener("submit", e => {
  e.preventDefault();
  if (submitAction) submitAction(new FormData(e.currentTarget));
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// STUDENTS
function studentFields(s = {}) {
  return `
    <label class="full">Full Name
      <input name="name" required minlength="2" value="${esc(s.name || "")}">
    </label>
    <label>Email
      <input name="email" type="email" required value="${esc(s.email || "")}">
    </label>
    <label>Phone
      <input name="phone" pattern="[0-9]{10}" maxlength="10" required value="${esc(s.phone || "")}">
    </label>
    <label>Course
      <select name="course" required>
        <option value="">Select Course</option>
        ${["B.Tech CSE", "BCA", "MCA", "BBA", "B.Com", "BA", "B.Sc"]
          .map(c => `<option ${s.course === c ? "selected" : ""}>${c}</option>`).join("")}
      </select>
    </label>
    <label>Year
      <select name="year" required>
        <option value="">Select Year</option>
        ${["1st Year", "2nd Year", "3rd Year", "4th Year"]
          .map(y => `<option ${s.year === y ? "selected" : ""}>${y}</option>`).join("")}
      </select>
    </label>
    <label>Semester
      <input name="semester" type="number" min="1" max="8" value="${s.semester || 1}">
    </label>
    <label>Date of Birth
      <input name="dob" type="date" value="${esc(s.dob || "")}">
    </label>
    <label class="full">Address
      <textarea name="address">${esc(s.address || "")}</textarea>
    </label>
    <label class="full">Profile Photo
      <input name="photo" type="file" accept="image/*">
    </label>
  `;
}

function openStudent(id = null) {
  const old = id ? student(id) : null;

  openModal(old ? "Edit Student" : "Register Student",
    studentFields(old || {}), async data => {

      const email = String(data.get("email")).trim().toLowerCase();

      if (db.students.some(s => s.email.toLowerCase() === email && s.id !== id)) {
        return toast("Email already registered.");
      }

      let photo = old?.photo || "";
      const file = data.get("photo");

      if (file?.size) {
        if (file.size > 900000) return toast("Choose an image below 900 KB.");

        photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const record = {
        ...(old || {}),
        id: old?.id || uid("STU"),
        name: String(data.get("name")).trim(),
        email,
        phone: data.get("phone"),
        course: data.get("course"),
        year: data.get("year"),
        semester: Number(data.get("semester")) || 1,
        dob: data.get("dob"),
        address: data.get("address"),
        photo,
        created: old?.created || new Date().toISOString()
      };

      if (old) {
        db.students = db.students.map(s => s.id === id ? record : s);
        log("Updated student " + record.name);
      } else {
        db.students.unshift(record);
        log("Registered " + record.name);
      }

      save();
      closeModal();
      refresh();
      toast(old ? "Student updated." : "Student registered. ID: " + record.id);
    }, "STUDENT PROFILE");
}

document.querySelectorAll("[data-add-student]").forEach(b => {
  b.onclick = () => openStudent();
});

function renderStudents() {
  const query = $("student-search").value.toLowerCase();
  const course = $("course-filter").value;
  const sort = $("sort").value;

  let list = db.students.filter(s =>
    (!course || s.course === course) &&
    [s.name, s.email, s.id].some(v => String(v).toLowerCase().includes(query))
  );

  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "newest") list.sort((a, b) => b.created.localeCompare(a.created));
  if (sort === "oldest") list.sort((a, b) => a.created.localeCompare(b.created));

  $("students-table").innerHTML = list.map(s => {
    const status = db.attendance[today()]?.[s.id] || "Not marked";

    return `<tr>
      <td>${studentInfo(s)}</td>
      <td><span class="pill">${esc(s.id)}</span></td>
      <td>${esc(s.course)}</td>
      <td>${esc(s.year)}</td>
      <td>${esc(s.phone)}</td>
      <td><span class="pill ${status === "Present" ? "good" : status === "Absent" ? "bad" : ""}">${status}</span></td>
      <td>
        <button class="action" data-edit="${s.id}">Edit</button>
        <button class="action danger" data-delete="${s.id}">Delete</button>
        <button class="action" data-report="${s.id}">PDF</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No matching students.</td></tr>`;

  $("student-count").textContent = `${list.length} of ${db.students.length} students`;

  const current = $("course-filter").value;
  $("course-filter").innerHTML = '<option value="">All Courses</option>' +
    [...new Set(db.students.map(s => s.course))].sort()
      .map(c => `<option>${esc(c)}</option>`).join("");
  $("course-filter").value = current;
}

$("students-table").onclick = e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  const report = e.target.closest("[data-report]");

  if (edit) openStudent(edit.dataset.edit);
  if (del) deleteStudent(del.dataset.delete);
  if (report) reportPDF(report.dataset.report);
};

function deleteStudent(id) {
  const s = student(id);
  if (!s || !confirm("Delete " + s.name + " and related records?")) return;

  db.students = db.students.filter(x => x.id !== id);
  db.marks = db.marks.filter(x => x.studentId !== id);
  db.fees = db.fees.filter(x => x.studentId !== id);

  Object.values(db.attendance).forEach(day => delete day[id]);
  db.assignments.forEach(a => delete a.submissions[id]);

  log("Deleted student " + s.name);
  save();
  refresh();
  toast("Student deleted.");
}

$("student-search").oninput = renderStudents;
$("course-filter").onchange = renderStudents;
$("sort").onchange = renderStudents;

$("global-search").oninput = e => {
  showPage("students");
  $("student-search").value = e.target.value;
  renderStudents();
};

$("clear-filters").onclick = () => {
  $("student-search").value = "";
  $("course-filter").value = "";
  $("sort").value = "newest";
  renderStudents();
};

// CSV EXPORT / IMPORT
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

$("export-csv").onclick = () => {
  if (!db.students.length) return toast("No students to export.");

  const headers = ["id", "name", "email", "phone", "course", "year", "semester", "dob", "address"];
  const rows = [headers, ...db.students.map(s => headers.map(h => s[h] || ""))];

  download("\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"),
    "edusphere-students.csv", "text/csv");

  toast("CSV exported.");
};

$("import-csv").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast("CSV contains no student rows.");

    const headers = lines.shift().split(",").map(h => h.replace(/^"|"$/g, "").toLowerCase());
    let added = 0;

    lines.forEach(line => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((h, i) => obj[h] = (values[i] || "").replace(/^"|"$/g, ""));

      if (!obj.name || !obj.email ||
          db.students.some(s => s.email.toLowerCase() === obj.email.toLowerCase())) return;

      db.students.push({
        id: obj.id || uid("STU"),
        name: obj.name,
        email: obj.email,
        phone: obj.phone || "",
        course: obj.course || "B.Tech CSE",
        year: obj.year || "1st Year",
        semester: Number(obj.semester) || 1,
        address: obj.address || "",
        photo: "",
        created: new Date().toISOString()
      });
      added++;
    });

    log("Imported " + added + " students");
    save();
    refresh();
    toast(added + " students imported.");
  };

  reader.readAsText(file);
  e.target.value = "";
};

// JSON BACKUP AND RESTORE
$("backup").onclick = () => {
  download(JSON.stringify(db, null, 2), "edusphere-backup.json", "application/json");
  toast("Backup downloaded.");
};

$("restore").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.students)) throw new Error();

      db = { ...emptyDB(), ...data };
      save();
      refresh();
      toast("Backup restored.");
    } catch {
      toast("Invalid backup file.");
    }
  };

  reader.readAsText(file);
  e.target.value = "";
};

// ATTENDANCE
$("attendance-date").value = today();

function renderAttendance() {
  const date = $("attendance-date").value || today();
  const day = db.attendance[date] || {};
  const values = Object.values(day);

  const present = values.filter(x => x === "Present").length;
  const absent = values.filter(x => x === "Absent").length;

  $("att-present").textContent = present;
  $("att-absent").textContent = absent;
  $("att-rate").textContent = db.students.length
    ? Math.round(present / db.students.length * 100) + "%"
    : "0%";

  $("attendance-list").innerHTML = db.students.map(s => `
    <div class="attendance-row">
      ${studentInfo(s)}
      <span class="pill">${day[s.id] || "Not marked"}</span>
      <div class="attendance-actions">
        <button class="present" data-att="${s.id}|Present">Present</button>
        <button class="absent" data-att="${s.id}|Absent">Absent</button>
        <button class="leave" data-att="${s.id}|Leave">Leave</button>
      </div>
    </div>
  `).join("") || "Add students first.";

  $("attendance-history").innerHTML = db.students.filter(s => day[s.id])
    .map(s => `<tr><td>${esc(s.name)}</td><td>${dateText(date)}</td><td>${day[s.id]}</td></tr>`)
    .join("") || '<tr><td colspan="3">No attendance recorded.</td></tr>';
}

$("attendance-list").onclick = e => {
  const btn = e.target.closest("[data-att]");
  if (!btn) return;

  const [id, status] = btn.dataset.att.split("|");
  const date = $("attendance-date").value || today();

  db.attendance[date] ||= {};
  db.attendance[date][id] = status;

  log("Marked " + student(id)?.name + " " + status);
  save();
  renderAttendance();
  renderStudents();
  dashboard();
  toast("Attendance marked " + status);
};

$("attendance-date").onchange = renderAttendance;

$("mark-all").onclick = () => {
  const date = $("attendance-date").value || today();
  db.attendance[date] ||= {};

  db.students.forEach(s => db.attendance[date][s.id] = "Present");

  log("Marked all students present");
  save();
  refresh();
  toast("All students marked present.");
};

$("attendance-export").onclick = () => {
  const rows = [["Date", "Student ID", "Name", "Status"]];

  Object.entries(db.attendance).forEach(([date, day]) => {
    Object.entries(day).forEach(([id, status]) => {
      rows.push([date, id, student(id)?.name || "Unknown", status]);
    });
  });

  download(rows.map(r => r.map(csvCell).join(",")).join("\r\n"),
    "attendance-history.csv", "text/csv");

  toast("Attendance exported.");
};

// MARKS AND GRADES
$("add-mark").onclick = () => {
  if (!db.students.length) return toast("Add a student first.");

  openModal("Add Academic Marks", `
    <label class="full">Student
      <select name="studentId">${db.students.map(s =>
        `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    </label>
    <label>Subject<input name="subject" required></label>
    <label>Exam / Term<input name="term"></label>
    <label>Marks Obtained<input name="marks" type="number" min="0" required></label>
    <label>Maximum Marks<input name="max" type="number" min="1" value="100" required></label>
  `, data => {
    const marks = Number(data.get("marks"));
    const max = Number(data.get("max"));

    if (marks < 0 || max <= 0 || marks > max) {
      return toast("Check marks and maximum marks.");
    }

    db.marks.unshift({
      id: uid("MRK"),
      studentId: data.get("studentId"),
      subject: data.get("subject"),
      term: data.get("term"),
      marks,
      max
    });

    log("Added " + data.get("subject") + " marks");
    save();
    closeModal();
    renderMarks();
    toast("Marks saved.");
  }, "ACADEMICS");
};

function renderMarks() {
  $("marks-table").innerHTML = db.marks.map(m => {
    const s = student(m.studentId);
    const percent = m.marks / m.max * 100;

    return `<tr>
      <td>${esc(s?.name || "Unknown")}</td>
      <td>${esc(m.subject)}</td>
      <td>${m.marks}</td>
      <td>${m.max}</td>
      <td>${percent.toFixed(1)}%</td>
      <td><span class="pill ${percent >= 50 ? "good" : "bad"}">${grade(percent)}</span></td>
      <td><button class="action danger" data-del-mark="${m.id}">Delete</button></td>
    </tr>`;
  }).join("");

  $("marks-empty").hidden = db.marks.length > 0;
}

$("marks-table").onclick = e => {
  const btn = e.target.closest("[data-del-mark]");
  if (!btn) return;

  db.marks = db.marks.filter(m => m.id !== btn.dataset.delMark);
  save();
  renderMarks();
  toast("Marks deleted.");
};

// FEES
$("add-fee").onclick = () => {
  if (!db.students.length) return toast("Add a student first.");

  openModal("Add Fee Record", `
    <label class="full">Student
      <select name="studentId">${db.students.map(s =>
        `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    </label>
    <label>Total Fee ₹<input name="total" type="number" min="0" required></label>
    <label>Paid ₹<input name="paid" type="number" min="0" value="0" required></label>
    <label class="full">Due Date<input name="due" type="date"></label>
  `, data => {
    const total = Number(data.get("total"));
    const paid = Number(data.get("paid"));

    if (total < 0 || paid < 0 || paid > total) {
      return toast("Invalid fee amounts.");
    }

    db.fees = db.fees.filter(f => f.studentId !== data.get("studentId"));
    db.fees.push({
      id: uid("FEE"),
      studentId: data.get("studentId"),
      total,
      paid,
      due: data.get("due")
    });

    log("Added or updated fee record");
    save();
    closeModal();
    renderFees();
    dashboard();
    toast("Fee record saved.");
  }, "FINANCE");
};

function renderFees() {
  let total = 0, paid = 0;

  $("fees-table").innerHTML = db.fees.map(f => {
    total += f.total;
    paid += f.paid;

    const due = f.total - f.paid;

    return `<tr>
      <td>${esc(student(f.studentId)?.name || "Unknown")}</td>
      <td>${money(f.total)}</td>
      <td>${money(f.paid)}</td>
      <td>${money(due)}</td>
      <td><span class="pill ${due === 0 ? "good" : "bad"}">${due === 0 ? "Paid" : "Pending"}</span></td>
      <td>
        <button class="action" data-pay="${f.id}">Record Payment</button>
        <button class="action danger" data-del-fee="${f.id}">Delete</button>
      </td>
    </tr>`;
  }).join("");

  $("fee-total").textContent = money(total);
  $("fee-paid").textContent = money(paid);
  $("fee-due").textContent = money(total - paid);
  $("fees-empty").hidden = db.fees.length > 0;
}

$("fees-table").onclick = e => {
  const pay = e.target.closest("[data-pay]");
  const del = e.target.closest("[data-del-fee]");

  if (pay) {
    const f = db.fees.find(x => x.id === pay.dataset.pay);
    const amount = prompt("Outstanding: " + money(f.total - f.paid) + ". Enter payment:");

    if (amount === null) return;

    const value = Number(amount);

    if (value <= 0 || value > f.total - f.paid) {
      return toast("Invalid payment amount.");
    }

    f.paid += value;
    log("Recorded payment " + money(value));
    save();
    renderFees();
    dashboard();
    toast("Payment recorded.");
  }

  if (del) {
    db.fees = db.fees.filter(f => f.id !== del.dataset.delFee);
    save();
    renderFees();
    dashboard();
    toast("Fee record deleted.");
  }
};

// ASSIGNMENTS
$("add-assignment").onclick = () => {
  openModal("Create Assignment", `
    <label class="full">Title<input name="title" required></label>
    <label>Course<input name="course" required></label>
    <label>Due Date<input name="due" type="date" required></label>
    <label class="full">Description<textarea name="description"></textarea></label>
  `, data => {
    db.assignments.unshift({
      id: uid("ASG"),
      title: data.get("title"),
      course: data.get("course"),
      due: data.get("due"),
      description: data.get("description"),
      submissions: {}
    });

    log("Created assignment " + data.get("title"));
    save();
    closeModal();
    renderAssignments();
    toast("Assignment created.");
  }, "CLASSROOM");
};

function renderAssignments() {
  $("assignment-grid").innerHTML = db.assignments.map(a => `
    <article class="assignment">
      <span class="pill">${esc(a.course)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.description || "No description")}</p>
      <p>Due: ${dateText(a.due)}</p>
      <button class="action" data-sub="${a.id}">Submissions</button>
      <button class="action danger" data-del-asg="${a.id}">Delete</button>
    </article>
  `).join("") || "No assignments created yet.";
}

$("assignment-grid").onclick = e => {
  const manage = e.target.closest("[data-sub]");
  const del = e.target.closest("[data-del-asg]");

  if (manage) {
    const a = db.assignments.find(x => x.id === manage.dataset.sub);
    if (!db.students.length) return toast("Add students first.");

    openModal("Track Submissions", db.students.map(s => `
      <label class="full">${esc(s.name)}
        <select name="${s.id}">
          <option value="Pending" ${!a.submissions[s.id] ? "selected" : ""}>Pending</option>
          <option value="Submitted" ${a.submissions[s.id] ? "selected" : ""}>Submitted</option>
        </select>
      </label>
    `).join(""), data => {
      db.students.forEach(s => a.submissions[s.id] = data.get(s.id) === "Submitted");
      save();
      closeModal();
      renderAssignments();
      toast("Submission statuses updated.");
    }, "ASSIGNMENTS");
  }

  if (del) {
    db.assignments = db.assignments.filter(a => a.id !== del.dataset.delAsg);
    save();
    renderAssignments();
    toast("Assignment deleted.");
  }
};

// CALENDAR
$("add-event").onclick = () => {
  openModal("Add Calendar Event", `
    <label class="full">Event Title<input name="title" required></label>
    <label>Date<input name="date" type="date" required></label>
    <label>Type
      <select name="type">
        <option>Exam</option><option>Holiday</option>
        <option>Workshop</option><option>Deadline</option><option>Other</option>
      </select>
    </label>
    <label class="full">Description<textarea name="description"></textarea></label>
  `, data => {
    db.events.push({
      id: uid("EVT"),
      title: data.get("title"),
      date: data.get("date"),
      type: data.get("type"),
      description: data.get("description")
    });

    db.events.sort((a, b) => a.date.localeCompare(b.date));
    log("Added event " + data.get("title"));
    save();
    closeModal();
    renderEvents();
    dashboard();
    toast("Event added.");
  }, "CALENDAR");
};

function renderEvents() {
  $("event-list").innerHTML = [...db.events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => `
      <div class="event-row">
        <div class="datebox">${new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", {day:"2-digit",month:"short"})}</div>
        <div class="grow"><strong>${esc(e.title)}</strong><small>${esc(e.type)} · ${dateText(e.date)}</small></div>
        <button class="action danger" data-del-event="${e.id}">Delete</button>
      </div>
    `).join("") || "No events scheduled.";
}

$("event-list").onclick = e => {
  const btn = e.target.closest("[data-del-event]");
  if (!btn) return;

  db.events = db.events.filter(x => x.id !== btn.dataset.delEvent);
  save();
  renderEvents();
  dashboard();
  toast("Event deleted.");
};

// ACTIVITY
function renderActivity() {
  $("activity-list").innerHTML = db.activity.map(a => `
    <div class="timeline-item">
      <strong>${esc(a.message)}</strong>
      <small>${new Date(a.time).toLocaleString("en-IN")}</small>
    </div>
  `).join("") || "No activity recorded.";
}

$("clear-activity").onclick = () => {
  if (!confirm("Clear activity history?")) return;
  db.activity = [];
  save();
  renderActivity();
  toast("Activity cleared.");
};

// NOTIFICATIONS
function renderNotifications() {
  $("notification-list").innerHTML = db.notifications.map(n => `
    <div class="notification">
      ${esc(n.message)}
      <small>${new Date(n.time).toLocaleString("en-IN")}</small>
    </div>
  `).join("") || "You're all caught up.";

  $("notification-dot").style.display = db.notifications.length ? "block" : "none";
}

$("notifications").onclick = () => $("notification-panel").classList.toggle("show");

$("clear-notifications").onclick = () => {
  db.notifications = [];
  save();
  renderNotifications();
};

document.addEventListener("click", e => {
  if (!e.target.closest("#notification-panel") &&
      !e.target.closest("#notifications")) {
    $("notification-panel").classList.remove("show");
  }
});

// PDF STUDENT REPORT
function reportPDF(id) {
  const s = student(id);

  if (!window.jspdf?.jsPDF) {
    return toast("PDF library needs an internet connection.");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(90, 70, 185);
  doc.text("EduSphere - Student Report", 20, 22);

  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text("Student ID: " + s.id, 20, 40);
  doc.text("Name: " + s.name, 20, 48);
  doc.text("Email: " + s.email, 20, 56);
  doc.text("Course: " + s.course, 20, 64);
  doc.text("Year / Semester: " + s.year + " / " + s.semester, 20, 72);

  doc.setFontSize(15);
  doc.text("Academic Results", 20, 90);

  let y = 100, total = 0, max = 0;

  db.marks.filter(m => m.studentId === id).forEach(m => {
    doc.setFontSize(10);
    doc.text(`${m.subject}: ${m.marks}/${m.max} (${grade(m.marks / m.max * 100)})`, 20, y);
    y += 8;
    total += m.marks;
    max += m.max;
  });

  if (max) {
    doc.text("Overall: " + (total / max * 100).toFixed(1) + "%", 20, y + 5);
  }

  const fee = db.fees.find(f => f.studentId === id);

  doc.setFontSize(12);
  doc.text("Fee Summary", 20, y + 22);
  doc.setFontSize(10);
  doc.text(fee
    ? `Total ${money(fee.total)} | Paid ${money(fee.paid)} | Due ${money(fee.total - fee.paid)}`
    : "No fee record", 20, y + 31);

  doc.save("EduSphere-" + s.id + "-report.pdf");
  toast("PDF report generated.");
}

// DASHBOARD AND CHARTS
function dashboard() {
  $("total-students").textContent = db.students.length;

  const day = db.attendance[today()] || {};
  const present = Object.values(day).filter(x => x === "Present").length;

  $("present-count").textContent = present;
  $("course-count").textContent = new Set(db.students.map(s => s.course)).size;
  $("pending-fees").textContent = money(
    db.fees.reduce((sum, f) => sum + f.total - f.paid, 0)
  );

  $("recent-students").innerHTML = db.students.slice(0, 5)
    .map(studentInfo).join("") || "No students yet.";

  $("upcoming-events").innerHTML = db.events
    .filter(e => e.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map(e => `<div class="event-row">
      <div class="datebox">${dateText(e.date)}</div>
      <div class="grow"><strong>${esc(e.title)}</strong></div>
    </div>`).join("") || "No upcoming events.";

  renderCharts();
}

function renderCharts() {
  if (!window.Chart) return;

  const courses = {};
  db.students.forEach(s => courses[s.course] = (courses[s.course] || 0) + 1);

  if (courseChart) courseChart.destroy();

  courseChart = new Chart($("course-chart"), {
    type: "bar",
    data: {
      labels: Object.keys(courses),
      datasets: [{
        data: Object.values(courses),
        backgroundColor: ["#8068ef", "#38bfa0", "#f3aa4e", "#4da7ec"],
        borderRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  const day = db.attendance[today()] || {};
  const absent = Object.values(day).filter(x => x === "Absent").length;
  const leave = Object.values(day).filter(x => x === "Leave").length;

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart($("attendance-chart"), {
    type: "doughnut",
    data: {
      labels: ["Present", "Absent", "Leave"],
      datasets: [{
        data: [Object.values(day).filter(x => x === "Present").length, absent, leave],
        backgroundColor: ["#24b889", "#ed7373", "#efa83b"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%"
    }
  });
}

// DARK MODE
let theme = localStorage.getItem("edusphere-theme") || "light";

document.body.classList.toggle("dark", theme === "dark");

$("theme-toggle").onclick = () => {
  theme = document.body.classList.contains("dark") ? "light" : "dark";
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("edusphere-theme", theme);
  $("theme-toggle").textContent = theme === "dark" ? "☀ Light Mode" : "☾ Dark Mode";
  renderCharts();
};

$("theme-toggle").textContent = theme === "dark" ? "☀ Light Mode" : "☾ Dark Mode";

$("today").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "short", day: "numeric", month: "short"
});

// REFRESH
function refresh() {
  renderStudents();
  renderAttendance();
  renderMarks();
  renderFees();
  renderAssignments();
  renderEvents();
  renderActivity();
  renderNotifications();
  dashboard();
}

refresh();

const initialPage = location.hash.slice(1);
if (initialPage && $("page-" + initialPage)) {
  showPage(initialPage);
}
