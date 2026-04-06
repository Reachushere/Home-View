# Master App Guide — Complete Reference

**Your academic task management dashboard: everything in one place.**

Generated: March 28, 2026
Combines: Self-Hosting Guide, Integration & OAuth Guide, Troubleshooting Guide, Split Routes Guide, Web Dev/Python/Bash/Grep Beginner Guide, HA YAML Reference, Cat Washroom Study Reading System Flows, and all updated source code.

---

# Table of Contents

## Part 1: Programming Fundamentals (Start Here If You're New)
1. What Is Programming?
2. HTML — The Structure of Web Pages
3. CSS — Making Things Look Good
4. JavaScript — Making Things Interactive
5. TypeScript — JavaScript With Safety Rails
6. React — Building User Interfaces
7. Node.js & Express — The Server Side
8. PostgreSQL & Drizzle — Databases
9. Python — General Purpose Programming
10. Bash — Talking to Your Computer
11. Grep — Searching Through Files
12. How All These Technologies Work Together

## Part 2: Understanding Your App
13. App Architecture Overview
14. What Connects to What
15. File Structure — Where Things Live
16. The Database — What's Stored Where

## Part 3: Self-Hosting Setup (Raspberry Pi)
17. Can I Run This on My Home Assistant Laptop?
18. Equipment to Buy
19. Step 1: Flash the Operating System
20. Step 2: First Boot
21. Step 3: Install System Dependencies
22. Step 4: Set Up the Database
23. Step 5: Create the App Directory
24. Step 6: Get the Code Out of Replit
25. Step 7: Set Up Environment Variables
26. Step 8: Setting Up OAuth Credentials (The Hard Part)
27. Step 9: Initialize the Database
28. Step 10: Build and Test
29. Step 11: Set Up Auto-Start (systemd Service)
30. Step 12: Set Up Log Rotation
31. Step 13: Update Home Assistant Webhooks
32. Step 14: Update Google Apps Script
33. Step 15: Touchscreen Setup

## Part 4: Integration & OAuth Setup (Detailed)
34. Overview: What Connects to What
35. CRITICAL: Replit Connector Rewrites
36. Integration 1: Home Assistant
37. Integration 2: Google Calendar
38. Integration 3: Gmail
39. Integration 4: Spotify
40. Integration 5: Microsoft OneDrive
41. Integration 6: Microsoft Outlook Calendar
42. Integration 7: OpenAI (TTS)
43. Integration 8: Resend (Email Sending)
44. Integration 9: Second Google Account (Partner Shifts)
45. Integration 10: Third Google Account (CRCU)
46. Integration 11: Object Storage
47. App Security: Site Password & Sessions
48. Complete .env Template
49. Testing Each Integration

## Part 5: Home Assistant YAML Reference
50. REST Commands (configuration.yaml)
51. HA Automations (automations.yaml)
52. HA Input Booleans

## Part 6: Cat Washroom Study Reading System — Complete Flow
53. Devices Involved
54. Flow A: Lights Turn ON — Full Prompt Flow
55. Flow B: Lights Turn OFF — Stop Everything
56. Flow C: Confirmed Playback Flow (Reading the PDF)
57. Flow D: Shower Button — Direct Play
58. Flow E: Volume Knob
59. Flow F: Knob Press — Master STOP
60. Flow G: Toothbrush Auto-Stop
61. Flow H: Voice Commands
62. Flow I: Play Urgent PDF
63. TTS Fallback Chain
64. Known Issues & Learnings (Nest Speaker)
65. Background Processes

## Part 7: Making Quick Changes to the App
66. How to Make a Quick Change (Step by Step)
67. Common Quick Changes
68. Where to Find Things in the Code

## Part 8: How to Split routes.ts Into Two Files
69. Why Split?
70. Step-by-Step Split Instructions

## Part 9: Testing with Home Assistant (2025+ Interface)
71. How to Test Webhooks and Services in HA
72. Testing REST Commands
73. Checking Entity States

## Part 10: Troubleshooting
74. ChatGPT Introduction Statement (Copy First Every Time)
75. Section-by-Section Troubleshooting
76. General: App Crashes / Won't Start
77. General: Database Issues
78. Quick Reference: Useful Commands

## Part 11: Ongoing Maintenance
79. Viewing Logs
80. Restarting / Updating / Backing Up
81. Key Differences from Replit
82. Estimated Migration Effort

## Part 12: ChatGPT Prompt Templates
83. Ready-to-Paste Prompts for Every Situation

## Appendices
84. Glossary

---
---

# PART 1: PROGRAMMING FUNDAMENTALS

If you already know how to code, skip to Part 2. If not, read this section first — it explains every technology your app uses, starting from absolute zero.

---

## What Is Programming?

Programming is writing instructions for a computer. That's it. A computer is extremely fast but extremely dumb — it does exactly what you tell it, nothing more and nothing less. If you tell it to do something wrong, it does the wrong thing very quickly.

A "programming language" is just a way to write those instructions in a format the computer can understand. There are hundreds of programming languages, but they all do the same basic thing: tell the computer what to do, step by step.

Your app uses several languages, each for a different job:

| Language | What It Does | Analogy |
|----------|-------------|---------|
| HTML | Defines what's on the page (headings, buttons, images) | The skeleton/frame of a house |
| CSS | Makes it look good (colors, spacing, fonts, layout) | The paint, furniture, and decor |
| JavaScript | Makes it interactive (responds to clicks, loads data) | The electricity and plumbing |
| TypeScript | JavaScript with extra safety checks | Electricity with circuit breakers |
| Python | General-purpose — scripts, automation, AI | A Swiss Army knife |
| Bash | Command-line interface to your computer | Talking directly to your computer |
| SQL | Talks to databases (stores and retrieves data) | A librarian who organizes and finds books |

When you visit your dashboard in a browser, here's what happens:
1. HTML defines the content — headings, task cards, buttons, calendar
2. CSS makes it look good — the dark theme, spacing, colors, responsive layout
3. JavaScript/TypeScript makes it interactive — clicking a task, dragging things, loading calendar events
4. Node.js (JavaScript on a server) runs on the backend — handles API calls to Home Assistant, stores data in the database, generates TTS audio
5. Bash is how you manage everything on the server — starting/stopping the app, checking logs, installing updates

---

## HTML — The Structure of Web Pages

HTML stands for HyperText Markup Language. Every website you've ever visited is built on HTML. It's not really a "programming" language — it's a "markup" language, meaning it just describes what things ARE, not what they DO.

### What Does HTML Look Like?

HTML uses "tags" — special words wrapped in angle brackets < >. Most tags come in pairs: an opening tag and a closing tag (with a /):

```
<h1>This is a big heading</h1>
<p>This is a paragraph of text.</p>
<img src="cat.jpg" alt="A cute cat">
```

- <h1> means "this is a level-1 heading" (the biggest heading)
- <p> means "this is a paragraph"
- <img> means "this is an image" (notice it doesn't have a closing tag — some tags are self-closing)

### The Basic Structure of Every Web Page

Every HTML page follows this exact structure:

```
<!DOCTYPE html>
<html>
  <head>
    <title>My Page Title</title>
  </head>
  <body>
    <h1>Welcome!</h1>
    <p>This is my first web page.</p>
  </body>
</html>
```

- <!DOCTYPE html> — tells the browser "this is an HTML page" (always the first line)
- <html> — wraps everything on the page
- <head> — invisible stuff: the page title (shown in the browser tab), links to CSS files, metadata
- <body> — visible stuff: everything you actually see on the page
- <title> — the text in the browser tab

### Tags You'll See Most Often

| Tag | What It Does | Example |
|-----|-------------|---------|
| <h1> through <h6> | Headings, h1 is biggest, h6 is smallest | <h1>Main Title</h1> |
| <p> | A paragraph of text | <p>Hello world.</p> |
| <a> | A link (the href says where to go) | <a href="https://google.com">Click me</a> |
| <img> | An image (no closing tag needed) | <img src="photo.jpg" alt="My photo"> |
| <button> | A clickable button | <button>Save</button> |
| <input> | A text field, checkbox, etc. | <input type="text" placeholder="Type here"> |
| <div> | An invisible box that groups things together | <div class="card">...</div> |
| <span> | An invisible inline wrapper (for styling a word) | <span class="bold">important</span> |
| <ul> and <li> | An unordered (bullet) list with list items | <ul><li>Item 1</li></ul> |
| <table>, <tr>, <td> | A table with rows and cells | See examples below |

### What Is a <div>?

A <div> is like an invisible box. You use it to group content together so you can style or move the whole group at once. Think of it like a shipping container — you put things inside it and move the container.

```
<div class="product-card">
  <img src="shoe.jpg" alt="Running Shoe">
  <h2>Running Shoe</h2>
  <p class="price">$89.99</p>
  <button>Add to Cart</button>
</div>
```

This groups the image, title, price, and button into one "card" that you can style together.

### Classes and IDs

- "class" — a name you give to elements so CSS/JavaScript can find them. Multiple elements can share the same class:
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>

- "id" — a UNIQUE name. Only ONE element on the page should have a given id:
  <div id="main-header">This is the only header</div>

### Attributes

Extra information attached to a tag. They go inside the opening tag:

```
<img src="cat.jpg" alt="A cute cat" width="300">
<a href="https://google.com" target="_blank">Open Google in new tab</a>
```

- src = the file path or URL of the image
- alt = text shown if the image can't load (also used by screen readers)
- width = how wide to make the image in pixels
- href = where the link goes
- target="_blank" = open in a new tab

### Nesting (Tags Inside Tags)

Tags go inside other tags, like folders inside folders. The inner tag is a "child" of the outer tag:

```
<div>
  <h2>My Section</h2>
  <p>Some text inside the section.</p>
</div>
```

The <h2> and <p> are "children" of the <div>. The <div> is their "parent". This parent-child relationship is how you organize a page.

---

## CSS — Making Things Look Good

CSS stands for Cascading Style Sheets. It controls how HTML looks — colors, sizes, fonts, spacing, layouts. If HTML is the skeleton, CSS is the skin and clothes.

### How Does CSS Work?

You write "rules" that say "find this element and make it look like this":

```
.product-card {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  width: 300px;
}
```

This says: "Find every element with the class product-card and give it a white background, rounded corners, 20 pixels of inner spacing, a subtle shadow, and make it 300 pixels wide."

### CSS Selectors (How CSS Finds Elements)

```
h1 { }                -- All <h1> tags
.card { }             -- All elements with class="card"
#main-header { }      -- The ONE element with id="main-header"
div p { }             -- All <p> tags that are inside a <div>
.card:hover { }       -- A .card when the mouse hovers over it
```

The dot "." means "class". The hash "#" means "id". No prefix means "tag name."

### Colors

```
color: #333333;                       -- Text color (dark gray) using hex code
background-color: #f0f0f0;           -- Background color (light gray)
background-color: rgb(255, 0, 0);    -- Red using RGB (red, green, blue)
background-color: rgba(0, 0, 0, 0.5); -- Black at 50% opacity (a = alpha/transparency)
```

Hex codes: "#" followed by 6 characters (0-9 and A-F). #000000 = black, #FFFFFF = white, #FF0000 = red.

### Sizes

```
width: 300px;          -- Fixed width in pixels (a pixel is one tiny dot on screen)
width: 50%;            -- Half the parent element's width
height: 200px;         -- Fixed height
max-width: 1200px;     -- Won't grow beyond this
min-height: 100vh;     -- At least the full screen height (vh = viewport height)
font-size: 16px;       -- Text size
```

### Spacing: Padding vs Margin

This is one of the most important CSS concepts:

- "padding" = space INSIDE the box (between the border and the content)
- "margin" = space OUTSIDE the box (between this box and neighboring boxes)

Think of it like a picture frame:
- Padding is the matting inside the frame
- Margin is the wall space around the frame

```
padding: 20px;           -- 20px of space inside, on all 4 sides
margin: 10px;            -- 10px of space outside, on all 4 sides
padding: 10px 20px;      -- 10px top/bottom, 20px left/right
margin: 0 auto;          -- 0 top/bottom, auto left/right = CENTER the element
```

### Text Styling

```
font-size: 16px;                    -- Text size
font-weight: bold;                  -- Bold text (or use a number: 400=normal, 700=bold)
font-family: Arial, sans-serif;     -- Font choice
text-align: center;                 -- Center the text horizontally
line-height: 1.5;                   -- Space between lines (1.5 = 1.5x the font size)
color: #333;                        -- Text color
```

### Borders

```
border: 1px solid #ccc;            -- 1px gray solid border on all sides
border-radius: 8px;                -- Rounded corners (higher = rounder)
border-bottom: 2px solid blue;     -- Only a bottom border
```

### Flexbox — The Most Important Layout Tool

Flexbox is how you arrange items in a row or column. It's the most important layout tool in modern CSS:

```
.container {
  display: flex;               -- Turn on flexbox
  justify-content: center;     -- Center items horizontally
  align-items: center;         -- Center items vertically
  gap: 20px;                   -- 20px space between items
  flex-direction: row;         -- Items in a row (default)
  flex-wrap: wrap;             -- Wrap to next line if no room
}
```

Think of flexbox as saying "put these items in a row and here's how to space them out."

- justify-content = horizontal alignment (left, center, right, space-between)
- align-items = vertical alignment (top, center, bottom)
- flex-direction: column = stack items vertically instead of horizontally

### Responsive Design (Different Screen Sizes)

```
@media (max-width: 768px) {
  .container {
    flex-direction: column;     -- Stack vertically on small screens
  }
  .card {
    width: 100%;                -- Full width on mobile
  }
}
```

This says: "When the screen is 768 pixels wide or less (like a tablet or phone), change these styles."

### What Is Tailwind CSS?

Your app uses Tailwind CSS, which is a different way of writing CSS. Instead of writing CSS rules in a separate file, you put short class names directly on your HTML elements:

Traditional CSS way:
  <div class="card">Hello</div>
  Then in a CSS file: .card { background: white; padding: 20px; border-radius: 8px; }

Tailwind way (your app uses this):
  <div class="bg-white p-5 rounded-lg">Hello</div>

Tailwind class names are shortcuts:
- bg-white = background-color: white
- p-5 = padding: 1.25rem (about 20px)
- rounded-lg = border-radius: 8px
- text-center = text-align: center
- flex = display: flex
- gap-4 = gap: 1rem (about 16px)
- text-sm = small text, text-lg = large text
- font-bold = bold text
- mt-4 = margin-top, mb-4 = margin-bottom, mx-auto = center horizontally

---

## JavaScript — Making Things Interactive

JavaScript (JS) is the programming language of the web. It makes pages interactive — responding to clicks, loading data, updating content without reloading the page. Every modern website uses it.

JavaScript runs in the browser. When you visit a website, the browser downloads the HTML, CSS, and JavaScript files. The JS code runs on YOUR computer (not the server), making the page interactive.

### Variables — Storing Data

Variables are containers that hold data. Like a labeled box:

```
let name = "Bryn";              -- A piece of text (called a "string")
const age = 20;                 -- A number that won't change (constant)
let score = 0;                  -- A number that CAN change
let isLoggedIn = true;          -- true or false (called a "boolean")
let nothing = null;             -- Explicitly empty
```

- "let" = a variable that CAN be changed later (score = 10;)
- "const" = a variable that CANNOT be changed after creation
- Strings = text, always in quotes ("hello" or 'hello')
- Numbers = no quotes needed (42, 3.14)
- Booleans = true or false

### Template Literals (Putting Variables in Text)

Instead of awkward string concatenation, use backticks and ${}:

```
const name = "Bryn";
const age = 20;

-- Old way (messy):
const message = "My name is " + name + " and I'm " + age + " years old.";

-- New way (template literals — use backticks, not quotes):
const message = `My name is ${name} and I'm ${age} years old.`;
-- Result: "My name is Bryn and I'm 20 years old."
```

### Functions — Reusable Blocks of Code

A function is like a recipe — you define it once and can use it over and over:

```
-- Defining a function
function greet(name) {
  return "Hello, " + name + "!";
}

-- Using (calling) the function
greet("Bryn");      -- Returns "Hello, Bryn!"
greet("Alex");      -- Returns "Hello, Alex!"
```

- function greet(name) — defines a function called "greet" that takes one input called "name"
- return — sends a value back to whoever called the function
- The stuff inside { } is the function body — the instructions

Arrow functions are a shorter way to write the same thing:
```
const add = (a, b) => a + b;
add(5, 3);     -- Returns 8
```

### If/Else — Making Decisions

```
let temperature = 30;

if (temperature > 25) {
  console.log("It's hot outside!");
} else if (temperature > 15) {
  console.log("It's nice outside.");
} else {
  console.log("It's cold outside!");
}
```

- if (condition) — runs the code block if the condition is true
- else if — another condition to check if the first was false
- else — runs if ALL conditions above were false
- > means "greater than", < means "less than", >= means "greater than or equal to"
- === means "exactly equals" (use three equals, not two!)
- !== means "not equal to"
- && means "AND" (both must be true)
- || means "OR" (at least one must be true)

### Arrays — Lists of Things

An array is an ordered list. Items are numbered starting from 0 (not 1):

```
let fruits = ["apple", "banana", "cherry"];
fruits[0];                 -- "apple" (first item)
fruits[1];                 -- "banana" (second item)
fruits.length;             -- 3 (how many items)
fruits.push("date");       -- Add to the end
fruits.includes("banana"); -- true (is "banana" in the list?)

-- Loop through every item
fruits.forEach(fruit => {
  console.log(fruit);      -- Prints each fruit on its own line
});

-- Transform every item (creates a NEW array)
let upperFruits = fruits.map(f => f.toUpperCase());
-- ["APPLE", "BANANA", "CHERRY", "DATE"]

-- Filter items (creates a NEW array with only matching items)
let longNames = fruits.filter(f => f.length > 5);
-- ["banana", "cherry"]
```

### Objects — Collections of Key-Value Pairs

An object is like a dictionary — it stores data with named keys:

```
let student = {
  name: "Bryn",
  age: 20,
  major: "Computer Science",
  grades: [85, 92, 78]
};

student.name;              -- "Bryn"
student.grades[0];         -- 85
student.major = "Math";    -- Change a value
student.gpa = 3.8;         -- Add a new key
```

### Console.log — Seeing What's Happening

console.log() prints things to the browser's developer console (press F12 to see it):

```
console.log("Hello!");                    -- Prints: Hello!
console.log("Score:", score);             -- Prints: Score: 42
console.log("Student:", student);         -- Prints the whole object
```

This is the number 1 way to debug — if something isn't working, add console.log() to see what values your variables have.

### Events — Responding to User Actions

```
-- Find a button on the page
const button = document.getElementById("myBtn");

-- When it's clicked, do something
button.addEventListener("click", () => {
  document.getElementById("output").textContent = "You clicked!";
});
```

### Async/Await — Waiting for Things

Some operations take time (loading data from a server, reading a file). JavaScript uses async/await to handle this:

```
-- Fetch data from your server's API
const response = await fetch("/api/tasks");
const tasks = await response.json();
console.log(tasks);  -- The list of tasks from your database

-- Send data TO the server
await fetch("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Do homework", dueDate: "2026-04-01" })
});
```

- fetch() makes an HTTP request (like opening a URL)
- await pauses until the response comes back
- .json() converts the response text into a JavaScript object
- async goes on the function that contains await

### Destructuring — Unpacking Values

A shorthand for pulling values out of objects or arrays:

```
-- Instead of:
const name = student.name;
const age = student.age;

-- You can write:
const { name, age } = student;

-- For arrays:
const [first, second] = ["apple", "banana"];
-- first = "apple", second = "banana"
```

### Spread Operator — Copying and Merging

The ... operator copies or merges arrays/objects:

```
const original = [1, 2, 3];
const copy = [...original];           -- [1, 2, 3] (a separate copy)
const extended = [...original, 4, 5]; -- [1, 2, 3, 4, 5]

const defaults = { color: "blue", size: "medium" };
const custom = { ...defaults, size: "large" };
-- { color: "blue", size: "large" } — size got overridden
```

---

## TypeScript — JavaScript With Safety Rails

TypeScript is JavaScript with "types" added on top. Types tell the computer what KIND of data a variable holds, so it can catch mistakes before you even run the code.

```
-- JavaScript — no types, anything goes:
let name = "Bryn";
name = 42;              -- No error! But probably a bug.

-- TypeScript — types catch mistakes:
let name: string = "Bryn";
name = 42;              -- ERROR: Type 'number' is not assignable to type 'string'
```

### Common Types

```
let name: string = "Bryn";           -- Text
let age: number = 20;                -- Any number (integer or decimal)
let isStudent: boolean = true;       -- true or false
let grades: number[] = [85, 92, 78]; -- Array of numbers
let nothing: null = null;            -- Explicitly empty
```

### Interfaces — Defining Shapes

An interface defines the "shape" of an object — what properties it must have:

```
interface Task {
  id: number;
  title: string;
  dueDate: string;
  completed: boolean;
  priority: "A" | "B" | "C";  -- Can only be one of these three values
}

const myTask: Task = {
  id: 1,
  title: "Study for exam",
  dueDate: "2026-04-15",
  completed: false,
  priority: "A"
};
```

Your app defines all its data shapes in shared/schema.ts — this ensures the frontend and backend agree on what data looks like.

### Why TypeScript?

- Catches typos and type errors BEFORE you run the code
- Your editor gives you autocomplete suggestions (because it knows the types)
- Makes large codebases much easier to maintain
- Your .ts and .tsx files are TypeScript; .js and .jsx are JavaScript

---

## React — Building User Interfaces

React is a JavaScript library (created by Facebook) for building user interfaces. Instead of manually updating HTML when data changes, React does it automatically.

### Components

In React, everything is a "component" — a reusable piece of UI:

```
function TaskCard({ title, dueDate, completed }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>Due: {dueDate}</p>
      {completed && <span>Done</span>}
    </div>
  );
}

-- Use it like an HTML tag:
<TaskCard title="Study for exam" dueDate="April 15" completed={false} />
```

- A component is just a function that returns HTML-like code (called JSX)
- {} inside JSX lets you use JavaScript expressions
- Props (properties) are inputs passed to the component
- Components can be nested inside other components

### State — Data That Changes

useState lets a component remember and update data:

```
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Add 1</button>
    </div>
  );
}
```

- useState(0) creates a state variable starting at 0
- count is the current value
- setCount is the function to update it
- When setCount is called, React automatically re-renders the component with the new value

### JSX vs HTML

JSX looks like HTML but has some differences:
- Use className instead of class (because class is a reserved word in JavaScript)
- Use onClick instead of onclick (camelCase)
- Use {} to embed JavaScript: <p>{user.name}</p>
- Self-closing tags need a slash: <img />, <input />
- Components start with a capital letter: <TaskCard /> (lowercase = HTML tag)

---

## Node.js & Express — The Server Side

Node.js lets you run JavaScript OUTSIDE the browser — on a server. Your app's backend (the part that talks to databases, Home Assistant, and APIs) runs on Node.js.

Express is a framework (a set of pre-built tools) for Node.js that makes it easy to create a web server — it handles incoming requests, routes them to the right code, and sends responses back.

### How a Server Works

```
Browser (you) --> sends a request --> Server (Node.js/Express) --> processes it --> sends a response --> Browser shows it
```

For example:
1. You click "Load Tasks" on the dashboard
2. Browser sends: GET /api/tasks
3. Express receives this, runs the handler code
4. Handler queries PostgreSQL database
5. Database returns the task data
6. Express sends it back as JSON
7. React receives the JSON and displays the tasks

### Routes — Handling Different URLs

```
app.get("/api/tasks", (req, res) => {
  -- GET = reading data
  const tasks = await storage.getTasks();
  res.json(tasks);  -- Send back as JSON
});

app.post("/api/tasks", (req, res) => {
  -- POST = creating data
  const newTask = req.body;  -- Data sent by the browser
  const created = await storage.createTask(newTask);
  res.json(created);
});

app.patch("/api/tasks/:id", (req, res) => {
  -- PATCH = updating data
  -- :id is a variable — /api/tasks/42 means id = "42"
  const updated = await storage.updateTask(req.params.id, req.body);
  res.json(updated);
});

app.delete("/api/tasks/:id", (req, res) => {
  -- DELETE = removing data
  await storage.deleteTask(req.params.id);
  res.json({ success: true });
});
```

### HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read/fetch data | Load tasks, get calendar events |
| POST | Create new data | Add a new task, upload a file |
| PATCH or PUT | Update existing data | Edit a task title, change a due date |
| DELETE | Remove data | Delete a task |

### JSON — The Data Format

JSON (JavaScript Object Notation) is how the browser and server exchange data:

```
{
  "id": 1,
  "title": "Study for exam",
  "dueDate": "2026-04-15",
  "completed": false,
  "tags": ["school", "important"]
}
```

Rules: keys must be in double quotes, no trailing commas, no comments.

---

## PostgreSQL & Drizzle — Databases

PostgreSQL (often called "Postgres") is a database — it stores your data permanently. Unlike variables in code (which disappear when the app restarts), database data survives forever.

Think of a database as a collection of spreadsheets:
- Each "table" is like one spreadsheet (e.g., "tasks", "semesters", "courses")
- Each "row" is one record (e.g., one specific task)
- Each "column" is one field (e.g., "title", "dueDate", "completed")

### SQL — Talking to the Database

SQL (Structured Query Language) is how you ask the database questions:

```
-- Get all tasks (the * means "all columns")
SELECT * FROM tasks;

-- Get only incomplete tasks
SELECT * FROM tasks WHERE completed = false;

-- Get tasks sorted by due date
SELECT * FROM tasks ORDER BY due_date ASC;

-- Count how many tasks exist
SELECT COUNT(*) FROM tasks;

-- Add a new task
INSERT INTO tasks (title, due_date, completed) VALUES ('Study', '2026-04-15', false);

-- Update a task
UPDATE tasks SET completed = true WHERE id = 42;

-- Delete a task
DELETE FROM tasks WHERE id = 42;
```

### Drizzle ORM — SQL Without Writing SQL

Your app uses Drizzle ORM (Object-Relational Mapping). Instead of writing raw SQL, you write TypeScript:

```
-- In shared/schema.ts — defines the table:
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  dueDate: text("due_date"),
  completed: boolean("completed").default(false),
});

-- In server/storage.ts — uses the table:
const allTasks = await db.select().from(tasks);
const incompleteTasks = await db.select().from(tasks).where(eq(tasks.completed, false));
```

Drizzle translates your TypeScript into SQL automatically.

---

## Python — General Purpose Programming

Python is a general-purpose programming language known for being easy to read. Your app uses it indirectly — Edge TTS (one of the text-to-speech fallbacks) is a Python tool. You may also use Python for scripts and automation.

### Variables — Simpler Than JavaScript

Python doesn't need let or const:

```
name = "Bryn"
age = 20
pi = 3.14159
is_student = True         -- Note: True/False are CAPITALIZED in Python
```

### Indentation Matters!

Python uses spaces (usually 4) instead of { } braces to define code blocks. This is the biggest difference from JavaScript and the biggest gotcha for beginners:

```
-- CORRECT (4 spaces of indentation):
if age >= 18:
    print("You're an adult")
    print("You can vote")

-- BROKEN (no indentation):
if age >= 18:
print("You're an adult")        -- This will cause an error!
```

If your Python code gives an "IndentationError", it means your spaces are wrong.

### Lists (Like JavaScript Arrays)

```
fruits = ["apple", "banana", "cherry"]
fruits[0]                 -- "apple"
len(fruits)               -- 3 (length — note: it's a function, not .length)
fruits.append("date")     -- Add to end

-- Loop through
for fruit in fruits:
    print(fruit)

-- List comprehensions (create a new list by transforming another):
upper_fruits = [f.upper() for f in fruits]
long_names = [f for f in fruits if len(f) > 5]
```

### Dictionaries (Like JavaScript Objects)

```
student = {
    "name": "Bryn",
    "age": 20,
    "major": "Computer Science"
}

student["name"]             -- "Bryn"
student["gpa"] = 3.8        -- Add new key
```

### Functions

```
def calculate_average(grades):
    total = sum(grades)
    return total / len(grades)

my_grades = [85, 92, 78, 95, 88]
avg = calculate_average(my_grades)
print(f"Your average is {avg}")
```

The f"..." syntax is Python's version of template literals (like JavaScript's backticks).

### If/Elif/Else

```
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"

print(f"Your grade is {grade}")       -- "Your grade is B"
```

Note: Python uses "elif" (not "else if"), and uses ":" instead of "{".

### Importing Modules

```
import math
print(math.sqrt(144))    -- 12.0

import random
print(random.randint(1, 100))     -- Random number between 1 and 100

from datetime import datetime
now = datetime.now()
print(now.strftime("%B %d, %Y"))     -- "March 28, 2026"
```

### File Operations

```
-- Write to a file
with open("notes.txt", "w") as f:
    f.write("Hello, world!\n")
    f.write("Second line.\n")

-- Read a file
with open("notes.txt", "r") as f:
    content = f.read()
    print(content)
```

### Installing Python Packages

```
pip3 install edge-tts            -- Install a package
pip3 install requests            -- Another popular package
```

---

## Bash — Talking to Your Computer

Bash is the language of the terminal (also called the command line, shell, or console). It's how you talk directly to your computer without a graphical interface. Every Mac, Linux computer, and server uses it. On Windows, you can use Git Bash, PowerShell, or WSL.

The terminal is a text-only window where you type commands and the computer responds with text. No clicking, no windows — just typing.

### Your First Commands — Navigating

Think of your computer's files like a big folder tree. You're always "standing in" one folder.

```
pwd                         -- Print Working Directory — shows WHERE you are right now
                            -- Example output: /home/bryn/Documents

ls                          -- List — shows files and folders in your current location
ls -l                       -- Long format — shows sizes, dates, permissions
ls -la                      -- Also show hidden files (files starting with .)
ls -lh                      -- Human-readable sizes (KB, MB, GB instead of bytes)

cd Documents                -- Change Directory — move INTO the Documents folder
cd ..                       -- Go UP one level (back to parent folder)
cd ~                        -- Go to your home directory (shortcut)
cd /                        -- Go to the ROOT of the entire filesystem
```

Think of "cd" like double-clicking a folder, and "ls" like looking at what's inside.

### Creating, Copying, Moving, and Deleting

```
mkdir my-project            -- Make a new directory (folder)
mkdir -p a/b/c              -- Make nested folders all at once
touch notes.txt             -- Create an empty file

cp file.txt backup.txt              -- Copy a file
cp -r my-folder backup-folder       -- Copy a folder and EVERYTHING in it (-r = recursive)

mv old-name.txt new-name.txt        -- Rename a file
mv file.txt ~/Desktop/              -- Move a file to the Desktop

rm file.txt               -- DELETE a file (PERMANENT — no recycling bin!)
rm -r folder/             -- Delete a folder and everything in it
rm -rf folder/            -- Force delete — no confirmation prompts (DANGEROUS)
```

WARNING: "rm" is PERMANENT. There is no undo. There is no recycling bin. Always double-check before deleting.

### Reading Files

```
cat file.txt              -- Print the ENTIRE file to the screen (good for short files)
head file.txt             -- Show the first 10 lines
head -n 20 file.txt       -- Show the first 20 lines
tail file.txt             -- Show the last 10 lines
tail -f log.txt           -- FOLLOW a file live — new lines appear as they're added
                          -- (great for watching logs — press Ctrl+C to stop)
less file.txt             -- View a file page by page (press q to quit, arrow keys to scroll)
wc -l file.txt            -- Count the number of lines in a file
```

### Pipes — The Conveyor Belt

The pipe "|" takes the output of one command and feeds it into another. This is one of Bash's superpowers:

```
ls -la | head -5                    -- List files, but only show the first 5 lines
cat file.txt | wc -l                -- Count lines in a file
history | tail -20                  -- Show your last 20 commands
```

Think of "|" like a conveyor belt: the output of the left side slides into the input of the right side.

### Redirecting Output

```
echo "Hello" > file.txt             -- Write "Hello" to file (OVERWRITES the file!)
echo "World" >> file.txt            -- APPEND "World" to file (adds to the end)
```

- > overwrites the entire file
- >> adds to the end of the file

### Environment Variables

Environment variables are settings stored in your terminal session:

```
echo $HOME                  -- Print the value of the HOME variable
export MY_VAR="hello"       -- Set a variable for this session
echo $MY_VAR                -- Print it

-- Your app uses these (stored in the .env file):
DATABASE_URL=postgresql://user:pass@localhost/mydb
HOME_ASSISTANT_TOKEN=eyJ...
```

### Chaining Commands

```
mkdir project && cd project                  -- Do both — only cd if mkdir succeeds
npm install && npm run build                 -- Install, then build
command1 ; command2                          -- Run both regardless of success
npm run dev &                                -- Run in background (& at the end)
```

- && means "AND" — run the second command only if the first one succeeded
- ; means "then" — run the second command regardless
- & means "run in the background"

### Useful System Commands

```
clear                       -- Clear the terminal screen (Ctrl+L also works)
history                     -- Show all your past commands
whoami                      -- Show your username
date                        -- Show current date and time
df -h                       -- Show disk space usage
du -sh folder/              -- Show total size of a folder
top                         -- Live view of running processes (q to quit)
kill 12345                  -- Stop a process by its ID number
chmod 755 script.sh         -- Change file permissions (make it executable)
```

### Running Programs

```
node app.js                 -- Run a JavaScript file with Node.js
python3 script.py           -- Run a Python script
npm install                 -- Install JavaScript packages from package.json
npm run dev                 -- Run a development server (defined in package.json)
npm run build               -- Build the app for production
pip install requests        -- Install a Python package
```

### SSH — Connecting to Another Computer

SSH lets you type commands on a remote computer (like your Raspberry Pi) from your own computer:

```
ssh pi@dashboard-server.local       -- Connect to the Pi
ssh pi@192.168.1.100                -- Same thing using IP address
-- You'll be asked for the password, then you're "inside" the Pi
-- Everything you type now runs on the Pi, not your computer
-- Type "exit" to disconnect
```

### SCP — Copying Files to Another Computer

```
scp file.txt pi@192.168.1.100:/opt/dashboard/     -- Copy a file to the Pi
scp -r folder/ pi@192.168.1.100:/opt/dashboard/   -- Copy a whole folder
```

---

## Grep — Searching Through Files

Grep stands for Global Regular Expression Print. It searches through files for lines that match a pattern. Think of it as Ctrl+F for your entire computer.

### Basic Usage

```
grep "error" log.txt                   -- Find lines containing "error"
grep -i "error" log.txt                -- Case-insensitive (finds Error, ERROR, error)
grep -n "error" log.txt                -- Show line numbers
grep -c "error" log.txt                -- Count matching lines
grep -r "TODO" .                       -- Search ALL files in current folder and subfolders
grep -l "error" *.txt                  -- Only show filenames that match (not the lines)
grep -v "debug" log.txt                -- Invert — show lines that DON'T match
grep -w "cat" file.txt                 -- Whole word only (won't match "catalog")
```

### Searching Specific File Types

```
grep "function" *.js                        -- Search all JavaScript files
grep -r "import" src/                       -- Search all files in src/ folder
grep -rn "TODO" --include="*.ts" .          -- Search only TypeScript files, show line numbers
```

### Combined with Pipes (Very Useful)

```
-- Find running Node processes
ps aux | grep "node"

-- Check if a package is installed
npm list | grep "express"

-- Find past commands you ran
history | grep "git"

-- Find PDF files
ls -la | grep -i ".pdf"

-- Count errors in a log
cat server.log | grep -c "ERROR"

-- Find where a function is defined in your codebase
grep -rn "calculateGrade" --include="*.ts" .
```

### Patterns (Regular Expressions)

```
grep "^Error" log.txt            -- Lines that START with "Error"
grep "done$" log.txt             -- Lines that END with "done"
grep "error\|warning" log.txt    -- Lines with "error" OR "warning"
grep "task-[0-9]" log.txt        -- "task-" followed by any digit
grep "2026-03-.." log.txt        -- Any date in March 2026
```

### Real-World Examples

```
-- Find all TODO comments in your codebase
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx" .

-- Find where a function is defined
grep -rn "function calculateGrade" --include="*.ts" .

-- Check server logs for errors
grep "ERROR" /var/log/app.log

-- Find all API endpoints in the server code
grep -rn "app\.\(get\|post\|put\|delete\)" --include="*.ts" server/

-- Count how many React components exist
grep -rl "export default function" --include="*.tsx" src/ | wc -l
```

---

## How All These Technologies Work Together

Here's what happens when you open your dashboard and click on a task:

```
                                YOUR COMPUTER (Browser)
                                - HTML defines the layout
                                - CSS makes it look good
                                - React (JavaScript) makes it interactive
                                - TypeScript catches errors at build time
                                         |
                          HTTP Request: GET /api/tasks
                                         |
                                         v
                                THE SERVER (Node.js + Express)
                                - Express routes the request
                                - TypeScript code handles the logic
                                - Drizzle ORM talks to the database
                                - Also talks to: HA, Google, Spotify, OneDrive
                                         |
                                    SQL Query
                                         |
                                         v
                                THE DATABASE (PostgreSQL)
                                - Stores all tasks, semesters, courses,
                                  settings, files permanently
```

| Technology | What It Is | Analogy |
|-----------|-----------|---------|
| HTML | Structure (what's on the page) | The skeleton/frame of a house |
| CSS | Style (how it looks) | The paint, furniture, and decor |
| JavaScript | Behavior (what it does) | The electricity and plumbing |
| TypeScript | JavaScript + safety | Electricity with circuit breakers |
| React | UI component framework | LEGO blocks you snap together |
| Node.js | JavaScript on servers | A chef in the kitchen (backend) |
| Express | Web server framework | The kitchen's recipe book |
| PostgreSQL | Database | A filing cabinet that never forgets |
| Drizzle | Database helper | A librarian who speaks TypeScript and SQL |
| Python | General-purpose language | A Swiss Army knife |
| Bash | Command-line interface | Talking directly to your computer |
| Grep | Search tool for files | Ctrl+F for your whole computer |

---
---

# PART 2: UNDERSTANDING YOUR APP

---

## App Architecture Overview

Your app is a full-stack web application — meaning it has both a frontend (what you see in the browser) and a backend (the server that handles data and API calls).

Frontend (React + TypeScript):
- Runs in the browser on your 1920x720 touchscreen
- Shows the dashboard, calendar, tasks, Spotify player, PDF reader, etc.
- Talks to the backend via HTTP API calls

Backend (Node.js + Express + TypeScript):
- Runs on the server (Replit now, Raspberry Pi later)
- Handles all API requests from the frontend
- Talks to Home Assistant, Google Calendar, Spotify, OneDrive, etc.
- Generates TTS audio for the cat washroom reading system
- Stores and retrieves data from the database

Database (PostgreSQL):
- Stores everything permanently: tasks, semesters, courses, settings, file records, playback state, etc.

---

## What Connects to What

| # | Service | What It Does in Your App | Auth Method |
|---|---------|--------------------------|-------------|
| 1 | Home Assistant | Smart home control, speaker playback, sensor data, webhooks | Long-lived access token |
| 2 | Google Calendar | Shows academic calendar events on dashboard | OAuth 2.0 (Replit connector) |
| 3 | Gmail | Reads D2L announcement emails, sends emails | OAuth 2.0 (Replit connector) |
| 4 | Spotify | Music player on dashboard (play, pause, playlists) | OAuth 2.0 (direct tokens) |
| 5 | Microsoft OneDrive | Syncs PDF course files for TTS reading | OAuth 2.0 (Replit connector) |
| 6 | Microsoft Outlook | Shows Outlook calendar events on dashboard | OAuth 2.0 (Replit connector) |
| 7 | OpenAI | Generates TTS audio from PDF text | API key (Replit AI integration) |
| 8 | Resend | Sends reminder emails (task due dates, daily digest) | API key |
| 9 | Second Google Account | Partner's work shift calendar | OAuth 2.0 (direct) |
| 10 | Third Google Account | CRCU partner shifts | OAuth 2.0 (direct) |
| 11 | Object Storage | Stores uploaded PDFs and TTS audio files | Replit-managed |

---

## File Structure — Where Things Live

| File/Folder | What It Contains |
|-------------|-----------------|
| shared/schema.ts | Database table definitions (the "shape" of all your data) |
| shared/electiveCourses.ts | Elective course catalog |
| shared/semesterUtils.ts | Semester date calculations |
| server/routes.ts | ALL backend API endpoints (~17,000 lines — the big one) |
| server/storage.ts | Database CRUD operations (create, read, update, delete) |
| server/index.ts | Server startup, middleware, authentication |
| server/email.ts | Email sending (Resend), Echo announcements |
| server/timezone.ts | Toronto timezone utilities |
| server/reminderScheduler.ts | Alexa reminder scheduler |
| server/googleCalendar.ts | Google Calendar API integration |
| server/outlookCalendar.ts | Outlook Calendar API integration |
| server/gmail.ts | Gmail API integration |
| server/onedrive.ts | OneDrive file sync, OneNote notebooks |
| server/spotify.ts | Spotify playback control |
| client/src/App.tsx | Frontend router (which page to show) |
| client/src/pages/dashboard.tsx | Main dashboard page (the big frontend file) |
| client/src/pages/onenote.tsx | OneNote notebooks browser page |
| client/src/pages/spotify-player.tsx | Spotify floorplan player |
| client/src/pages/pdf-reader.tsx | PDF reader with TTS follow-along |
| client/src/pages/code-checker.tsx | Code Checker tool |
| client/src/index.css | All CSS styles (including theme colors) |

---

## The Database — What's Stored Where

Key tables in shared/schema.ts:

| Table | What It Stores |
|-------|---------------|
| tasks | All your academic tasks (assignments, readings, exams) |
| semesters | Semester date ranges, active status |
| courses | Course names, codes, colors, priorities |
| settings | App settings (weather, semester, display preferences) |
| file_records | PDF file metadata (listened status, chunk progress, TTS audio) |
| announcements | Ticker announcements |
| app_state | Persistent state (playback sessions survive server restarts) |
| shared_notebook_links | OneNote shared notebook URLs |

---
---

# PART 3: SELF-HOSTING SETUP (RASPBERRY PI)

---

## Can I Run This on My Home Assistant Laptop?

No, not directly. Home Assistant OS is a locked-down, purpose-built Linux distribution — it manages its own filesystem, networking, and containers. You can't install Node.js, PostgreSQL, or run arbitrary apps alongside it. A Raspberry Pi 5 on the same local network is the right approach — fast, cheap, always-on, and won't interfere with your HA installation.

---

## Equipment to Buy

| Item | Model / Spec | Approx. Price | Amazon Link |
|------|-------------|---------------|-------------|
| Raspberry Pi 5 | 8 GB RAM | ~$80 USD | amazon.ca/dp/B0CK2FCG1K |
| Power Supply | Official Pi 5 27W USB-C | ~$12 | amazon.ca/dp/B0CN1HP2P7 |
| microSD Card | Samsung EVO Select 128 GB (A2-rated) | ~$13 | amazon.ca/dp/B09B1HMJ9Z |
| Active Cooler | Official Pi 5 Active Cooler | ~$5 | amazon.ca/dp/B0CN1GXRKQ |
| Case | Official Pi 5 Case | ~$10 | amazon.ca/dp/B0CN1HP2RZ |
| Ethernet Cable | Cat 6, 3-foot | ~$5 | amazon.ca/dp/B00N2VILDM |
| USB microSD Reader | Anker USB 3.0 | ~$8 | amazon.ca/dp/B006T9B6R2 |

Total: ~$125-135 USD

Notes:
- 8 GB Pi 5 is essential — Node.js + PostgreSQL + TTS need the memory
- Official 27W power supply prevents random crashes and SD card corruption
- microSD must be A2-rated for PostgreSQL's random read/write speed
- Active cooler needed because TTS processing pushes CPU under sustained load
- Skip the USB reader if your PC has a microSD slot

---

## Step 1: Flash the Operating System

1. Download Raspberry Pi Imager from raspberrypi.com/software
2. Insert microSD into your computer
3. Choose: Device = Raspberry Pi 5, OS = Raspberry Pi OS (64-bit, Lite)
4. Click gear icon and configure: Enable SSH = Yes, Username = pi, Password = (strong password), Wi-Fi = your network, Hostname = dashboard-server
5. Flash and wait for verification

## Step 2: First Boot

1. Insert microSD into Pi 5
2. Connect ethernet to router
3. Plug in power
4. Wait ~2 minutes
5. From your computer: ssh pi@dashboard-server.local
6. If hostname doesn't resolve, check router admin page for Pi's IP: ssh pi@<IP_ADDRESS>

## Step 3: Install System Dependencies

```
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo apt install -y postgresql postgresql-contrib

sudo apt install -y build-essential git

sudo apt install -y espeak-ng

sudo apt install -y python3-pip
pip3 install edge-tts --break-system-packages
```

Verify:
```
node --version        -- Should show v20.x.x
psql --version        -- Should show 16.x
espeak-ng --version
edge-tts --version
```

## Step 4: Set Up the Database

```
sudo -u postgres psql -c "CREATE USER dashboard WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE dashboard_db OWNER dashboard;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dashboard_db TO dashboard;"
```

Replace CHOOSE_A_STRONG_PASSWORD with a real password. Write it down.

## Step 5: Create the App Directory

```
sudo mkdir -p /opt/dashboard
sudo chown pi:pi /opt/dashboard
cd /opt/dashboard
```

## Step 6: Get the Code Out of Replit

Option A — Download as ZIP (easiest):
1. In Replit, click three dots (...) at top of file panel
2. Click "Download as ZIP"
3. Transfer to Pi: scp ~/Downloads/home-view.zip pi@dashboard-server.local:/opt/dashboard/
4. On Pi: cd /opt/dashboard && sudo apt install -y unzip && unzip home-view.zip && npm install

Option B — Push to GitHub (better for updates):
1. In Replit, click Git icon, connect to GitHub
2. On Pi: cd /opt/dashboard && git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git . && npm install
3. Future updates: git pull && npm install && npm run build && sudo systemctl restart dashboard

## Step 7: Set Up Environment Variables

```
nano /opt/dashboard/.env
```

Paste (fill in your values):
```
DATABASE_URL=postgresql://dashboard:YOUR_PASSWORD@localhost:5432/dashboard_db
HOME_ASSISTANT_TOKEN=your_ha_long_lived_access_token
DEPLOYED_APP_URL=http://dashboard-server.local:5000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
MICROSOFT_CLIENT_ID=your_azure_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret
MICROSOFT_REFRESH_TOKEN=your_microsoft_refresh_token
```

Save (Ctrl+X, Y, Enter) and secure: chmod 600 /opt/dashboard/.env

## Step 8: Setting Up OAuth Credentials (The Hard Part)

On Replit, integration connectors handle OAuth automatically. On the Pi, you register apps with each service and get refresh tokens manually. See Part 4 for detailed instructions.

## Step 9: Initialize the Database

```
cd /opt/dashboard
npm run db:push
```

Type "yes" if asked for confirmation.

## Step 10: Build and Test

```
npm run build
node dist/index.js
```

Open http://dashboard-server.local:5000 in a browser. Verify dashboard loads. Ctrl+C to stop.

## Step 11: Set Up Auto-Start (systemd Service)

```
sudo nano /etc/systemd/system/dashboard.service
```

Paste:
```
[Unit]
Description=Dashboard App
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/dashboard
EnvironmentFile=/opt/dashboard/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/dashboard.log
StandardError=append:/var/log/dashboard-error.log

[Install]
WantedBy=multi-user.target
```

Enable:
```
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard
sudo systemctl status dashboard
```

## Step 12: Set Up Log Rotation

```
sudo nano /etc/logrotate.d/dashboard
```

Paste:
```
/var/log/dashboard.log /var/log/dashboard-error.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 pi pi
}
```

## Step 13: Update Home Assistant Webhooks

In your HA configuration.yaml, change all rest_command URLs from:
  https://home-view--bkh416.replit.app/api/webhook/...
To:
  http://dashboard-server.local:5000/api/webhook/...
Or use the Pi's static IP for reliability.

## Step 14: Update Google Apps Script

If you have a Google Apps Script pushing emails to the app, update URLs.

Important: Google Apps Script runs in the cloud and can't reach your local Pi. Options:
- Cloudflare Tunnel (free, recommended)
- Static public IP with port forwarding
- Keep Replit just for the Gmail webhook

## Step 15: Touchscreen Setup

Open http://dashboard-server.local:5000 on your 1920x720 touchscreen. Bookmark or set as homepage.

---
---

# PART 4: INTEGRATION & OAUTH SETUP (DETAILED)

---

## Overview: What Connects to What

| # | Service | Auth Method | Code Change Needed? |
|---|---------|-------------|-------------------|
| 1 | Home Assistant | Long-lived access token | No |
| 2 | Google Calendar | OAuth 2.0 | YES (connector rewrite) |
| 3 | Gmail | OAuth 2.0 | YES (connector rewrite) |
| 4 | Spotify | OAuth 2.0 | Small (redirect URI) |
| 5 | OneDrive | OAuth 2.0 | YES (connector rewrite) |
| 6 | Outlook Calendar | OAuth 2.0 | YES (connector rewrite) |
| 7 | OpenAI | API key | Small (env var name) |
| 8 | Resend | API key | No |
| 9 | Second Google | OAuth 2.0 | Small (redirect URI) |
| 10 | Third Google | OAuth 2.0 | Small (redirect URI) |
| 11 | Object Storage | Replit-managed | YES (full replacement) |

---

## CRITICAL: Replit Connector Rewrites

This is the most important section. Four files use Replit's connector system for OAuth. On a Pi, this doesn't exist. You must rewrite the auth function in:

| File | Replace This Function |
|------|----------------------|
| server/googleCalendar.ts | getAccessToken() |
| server/gmail.ts | getAccessToken() |
| server/onedrive.ts | getAccessToken() |
| server/outlookCalendar.ts | getOutlookAccessToken() |

### Replacement Pattern for Google Services

```
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Failed to refresh Google token: ' + error);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken!;
}
```

### Replacement Pattern for Microsoft Services

Same pattern, different URL and env vars:

```
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite Files.ReadWrite.All Calendars.Read Mail.Read User.Read offline_access',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Failed to refresh Microsoft token: ' + error);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.log('[Microsoft] Got new refresh token - update your .env MICROSOFT_REFRESH_TOKEN');
  }

  return cachedAccessToken!;
}
```

---

## Integration 1: Home Assistant

Difficulty: Easy | Code change: No

1. Open HA in browser
2. Click your profile (bottom-left)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token", name it "Dashboard App"
5. Copy immediately

.env:
```
HOME_ASSISTANT_TOKEN=eyJ0eX...your_token
HOME_ASSISTANT_URL_OVERRIDE=https://your-nabu-casa-url.ui.nabu.casa
```

Test: curl -s -H "Authorization: Bearer YOUR_TOKEN" https://YOUR_HA_URL/api/

---

## Integration 2: Google Calendar

Difficulty: Medium-Hard | Code change: YES

1. Go to console.cloud.google.com
2. Create project "Dashboard App"
3. Enable Google Calendar API (APIs & Services > Library)
4. Set up OAuth consent screen (External, add calendar.readonly scope, add your email as test user)
5. Create OAuth 2.0 Client ID (Credentials > Create > Web application)
6. Add redirect URI: http://dashboard-server.local:5000/api/google/callback
7. Copy Client ID and Client Secret

Get refresh token:
Open this URL (replace YOUR_CLIENT_ID):
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://dashboard-server.local:5000/api/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly&access_type=offline&prompt=consent
```

Copy the code from redirect URL, then exchange:
```
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=THE_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://dashboard-server.local:5000/api/google/callback"
```

Copy the refresh_token from the response.

If token stops working: Redo the OAuth flow. To avoid 7-day expiry in Testing mode, publish the app.

---

## Integration 3: Gmail

Difficulty: Medium-Hard | Code change: YES

Same Google Cloud project as Calendar. Add Gmail API and scopes (gmail.readonly, gmail.send). Get a NEW refresh token with all scopes:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://dashboard-server.local:5000/api/google/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar.readonly%20https://www.googleapis.com/auth/gmail.readonly%20https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent
```

Same client ID/secret/refresh token works for both Calendar and Gmail.

---

## Integration 4: Spotify

Difficulty: Medium | Code change: Small

1. developer.spotify.com/dashboard > Create App
2. Add redirect URI: http://dashboard-server.local:5000/api/spotify/callback
3. In server/spotify.ts, replace redirect URI construction with:
   const host = process.env.DEPLOYED_APP_URL?.replace(/^https?:\/\//, '') || 'dashboard-server.local:5000';
   const redirectUri = 'http://' + host + '/api/spotify/callback';
4. Visit http://PI_IP:5000/api/spotify/login to authorize

---

## Integration 5: Microsoft OneDrive

Difficulty: Hard | Code change: YES

1. portal.azure.com > App registrations > New registration
2. Name: "Dashboard", account type: any org + personal, redirect: http://dashboard-server.local:5000/api/microsoft/callback
3. Create client secret (Certificates & secrets)
4. Add permissions: Files.ReadWrite, Files.ReadWrite.All, User.Read

Get refresh token:
```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://dashboard-server.local:5000/api/microsoft/callback&scope=Files.ReadWrite%20Files.ReadWrite.All%20User.Read%20offline_access&response_mode=query
```

Exchange the code:
```
curl -X POST https://login.microsoftonline.com/common/oauth2/v2.0/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=THE_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://dashboard-server.local:5000/api/microsoft/callback" \
  -d "scope=Files.ReadWrite%20Files.ReadWrite.All%20User.Read%20offline_access"
```

Important: Microsoft sometimes issues a NEW refresh token. Update .env when you see the log warning.

---

## Integration 6: Microsoft Outlook Calendar

Difficulty: Hard | Code change: YES

Same Azure app as OneDrive. Add Calendars.Read, Mail.Read permissions. Get new refresh token with all scopes.

One token works for both OneDrive and Outlook (same Azure app, same env vars).

---

## Integration 7: OpenAI (TTS)

Difficulty: Easy | Code change: Small

1. platform.openai.com > API keys > Create
2. .env: OPENAI_API_KEY=sk-xxx
3. Change AI_INTEGRATIONS_OPENAI_API_KEY to OPENAI_API_KEY in code

Cost: ~$0.015 per 1,000 chars. Full semester ~$3-4. Free fallbacks work if credits run out.

---

## Integration 8: Resend (Email Sending)

Difficulty: Easy | Code change: No

1. resend.com > sign up (100 free emails/day)
2. Create API Key
3. .env: RESEND_API_KEY=re_xxx

---

## Integration 9: Second Google Account (Partner Shifts)

In server/secondGoogleAccount.ts, fix redirect URI:
```
const domain = process.env.DEPLOYED_APP_URL?.replace(/^https?:\/\//, '') || 'dashboard-server.local:5000';
```

## Integration 10: Third Google Account

Same fix in server/thirdGoogleAccount.ts.

---

## Integration 11: Object Storage

On Pi, Replit Object Storage doesn't exist. Options:

Option A: Local File System (Simplest)
- Create /opt/dashboard/uploads/public/ and /opt/dashboard/uploads/private/
- Rewrite upload endpoints to use fs.writeFileSync
- Serve public files via Express static middleware

Option B: MinIO (S3-Compatible)
```
wget https://dl.min.io/server/minio/release/linux-arm64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
mkdir -p /opt/minio-data
minio server /opt/minio-data --console-address ":9001"
```

---

## App Security

SITE_PASSWORD: Protects the dashboard. Leave empty for local-only access.
SESSION_SECRET: Generate with: openssl rand -hex 32

---

## Complete .env Template

```
# ========== DATABASE ==========
DATABASE_URL=postgresql://dashboard:YOUR_DB_PASSWORD@localhost:5432/dashboard_db

# ========== APP ==========
DEPLOYED_APP_URL=http://dashboard-server.local:5000
PORT=5000
SITE_PASSWORD=your_dashboard_login_password
SESSION_SECRET=generate_with_openssl_rand_hex_32
NODE_ENV=production

# ========== HOME ASSISTANT ==========
HOME_ASSISTANT_TOKEN=eyJ0eX...your_ha_long_lived_token
HOME_ASSISTANT_URL_OVERRIDE=https://your-ha-url.ui.nabu.casa

# ========== GOOGLE (Calendar + Gmail) ==========
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//0exxxxxxxxxx

# ========== GOOGLE (Second Account) ==========
GOOGLE_SECOND_ACCOUNT_CLIENT_ID=same_or_different
GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET=same_or_different

# ========== SPOTIFY ==========
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# ========== MICROSOFT (OneDrive + Outlook) ==========
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_REFRESH_TOKEN=0.AAAA...very_long_token

# ========== OPENAI (TTS) ==========
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# ========== RESEND (Email) ==========
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# ========== TIMEZONE ==========
TZ=America/Toronto
```

---

## Testing Each Integration

Home Assistant: curl -s http://localhost:5000/api/version
Google Calendar: check dashboard for events
Spotify: curl -s http://localhost:5000/api/spotify/status
OneDrive: check file sync in logs
TTS: turn on cat lights, listen for prompt
Email: create a task with reminder

---
---

# PART 5: HOME ASSISTANT YAML REFERENCE

Replace YOUR_APP_URL with https://home-view--bkh416.replit.app (Replit) or http://dashboard-server.local:5000 (Pi).

---

## REST Commands (configuration.yaml)

```
rest_command:
  cat_lights_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-lights"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"state": "{{ states(''light.cat_lights'') }}"}'

  cat_lights_confirm_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-lights-confirm"
    method: POST
    headers:
      Content-Type: "application/json"

  cat_shower_button_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-shower-button"
    method: POST
    headers:
      Content-Type: "application/json"

  cat_wash_stop_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-wash-stop"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"trigger":"{{ trigger }}"}'

  cat_volume_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-volume"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"direction":"{{ direction }}","speed":"{{ speed }}"}'

  cat_knob_press_webhook:
    url: "YOUR_APP_URL/api/webhook/cat-knob-press"
    method: POST
    headers:
      Content-Type: "application/json"

  voice_command_webhook:
    url: "YOUR_APP_URL/api/webhook/voice-command"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"command":"{{ command }}"}'

  kitchen_volume_webhook:
    url: "YOUR_APP_URL/api/webhook/kitchen-volume"
    method: POST
    headers:
      Content-Type: "application/json"
    payload: '{"direction":"{{ direction }}","speed":"{{ speed }}"}'

  play_urgent_pdf_webhook:
    url: "YOUR_APP_URL/api/webhook/play-urgent-pdf"
    method: POST
    headers:
      Content-Type: "application/json"
      x-webhook-secret: "YOUR_SITE_PASSWORD"
    payload: '{"entity_id":"media_player.bathroom_speaker"}'
```

---

## HA Automations (automations.yaml)

Automation 1: Cat Washroom Lights Changed
```
automation:
  - alias: "Cat Washroom Lights Changed"
    trigger:
      - platform: state
        entity_id: light.cat_lights
    action:
      - service: rest_command.cat_lights_webhook
```

Automation 2: Cat Washroom Reading Confirmed
```
  - alias: "Cat Washroom Reading Confirmed"
    trigger:
      - platform: state
        entity_id: input_boolean.module_reading_confirmed
        to: "on"
    action:
      - service: rest_command.cat_lights_confirm_webhook
```

Automation 3: Cat Washroom Shower Button
```
  - alias: "Cat Washroom Shower Button"
    trigger:
      - platform: state
        entity_id: switch.cat_shower_button
    action:
      - service: rest_command.cat_shower_button_webhook
```

Automation 4: Cat Washroom Volume Knob
```
  - alias: "Cat Washroom Volume Up"
    trigger:
      - platform: state
        entity_id: sensor.cat_volume_knob_rotation
    action:
      - service: rest_command.cat_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "normal"

  - alias: "Cat Washroom Volume Fast"
    trigger:
      - platform: state
        entity_id: sensor.cat_volume_knob_fast_rotation
    action:
      - service: rest_command.cat_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "fast"
```

Automation 5: Cat Washroom Knob Press (STOP)
```
  - alias: "Cat Washroom Knob Press STOP"
    trigger:
      - platform: state
        entity_id: binary_sensor.cat_volume_knob_press
        to: "on"
    action:
      - service: rest_command.cat_knob_press_webhook
```

Automation 6: Kitchen Volume Knob
```
  - alias: "Kitchen Volume Up"
    trigger:
      - platform: state
        entity_id: sensor.kitchen_volume_knob_rotation
    action:
      - service: rest_command.kitchen_volume_webhook
        data:
          direction: "{{ 'up' if trigger.to_state.state | float > trigger.from_state.state | float else 'down' }}"
          speed: "normal"
```

---

## HA Input Booleans (configuration.yaml)

```
input_boolean:
  module_reading_pending:
    name: Module Reading Pending
    icon: mdi:book-open-page-variant
  module_reading_confirmed:
    name: Module Reading Confirmed
    icon: mdi:check-circle
```

---
---

# PART 6: CAT WASHROOM STUDY READING SYSTEM — COMPLETE FLOW

---

## Overview

The cat washroom has a study reading system that plays your school readings aloud on the Nest speaker while displaying the text on a Fire tablet and Samsung TV. Triggered by the cat washroom lights or shower button.

## Devices Involved

| Device | HA Entity | Role |
|--------|-----------|------|
| Cat Washroom Lights | light.cat_lights | Trigger (on/off) |
| Google Nest Speaker | media_player.bathroom_speaker | Main audio playback |
| HA Voice ESPHome | media_player.home_assistant_voice_097c38_media_player | Voice prompts |
| Fire Tablet | media_player.tablet_cat | PDF reader display |
| Samsung TV | media_player.tv_cat_wr | PDF reader follow-along |
| Fire Stick | media_player.fire_tv_172_24_0_88 | Drives TV via HDMI |
| Echo Cat Left | media_player.echo_cat_left_am | CHUM FM |
| Echo Cat Right | media_player.echo_cat_right_am | CHUM FM |
| Echo Cat Middle | media_player.echo_cat_washroom_middle | CHUM FM |
| Cat WR Media Group | media_player.cat_washroom_media_group | Multi-room CHUM FM |
| HA Cloud TTS | tts.home_assistant_cloud | Nabu Casa TTS |
| Toothbrush | sensor.toothbrush_bryn_toothbrush_state | Auto-stop trigger |

---

## FLOW A: Lights Turn ON — Full Prompt Flow

Trigger: light.cat_lights changes > HA calls rest_command.cat_lights_webhook
Endpoint: POST /api/webhook/cat-lights

1. Guards: Skip if server just started, already playing, or prompt pending
2. Query actual light state from HA — if "off" go to Flow B, if not "on" ignore
3. Immediate acknowledgment: Set volumes, set booleans, TTS "One moment, checking your readings."
4. Look up next unlistened file (modules first, then readings, by course priority)
5. Light re-check (abort if OFF)
6. If NO files: Play CHUM FM 104.5 on Echo group. Done.
7. If file found: TTS "Would you like to play week 8, C.P.P.A. 1 22 module?"
8. Wait 2 seconds
9. Light re-check #2 (abort if OFF)
10. Wait for confirmation (23 seconds): webhook or poll input_boolean
11. Reset HA booleans
12a. Not confirmed: Play CHUM FM. Done.
12b. Confirmed: Light re-check #3, TTS "Okay, I will now play...", start Flow C

## FLOW B: Lights Turn OFF — Stop Everything

1. If playing: Save progress, stop Nest, turn off Fire Stick/TV, goodbye TTS
2. If TTS active: Stop session
3. Stop ALL cat washroom speakers
4. Reset state flags

## FLOW C: Confirmed Playback Flow

1. Calculate resume point from database
2. Build tablet and TV URLs
3. PARALLEL: Wake tablet + TV, pre-generate audio, confirmation TTS
4. Set volume to 0.75
5. Chunk-by-chunk loop: generate/play audio, update database, sync displays
6. When complete: mark listened, auto-play next file or stop
7. Toothbrush polling runs alongside

## FLOW D: Shower Button — Skip Prompt

Skips 23-second wait. Finds file, immediately starts Flow C.

## FLOW E: Volume Knob

Normal: +/- 0.05 per click. Fast: +/- 0.15 per click. Clamped 0.0-1.0.

## FLOW F: Knob Press — Master STOP

Playing: full stop with goodbye. Not playing: stop all speakers.

## FLOW G: Toothbrush Auto-Stop

Polls toothbrush sensor every 3 seconds during playback. If brushing detected, stops everything.

## FLOW H: Voice Commands

| Command | Action |
|---------|--------|
| pause | Save progress, stop Nest, 10-min auto-stop timer |
| resume | Clear timer, resume from saved chunk |
| stop | Full stop with progress save |
| skip | Mark complete, play next or stop |
| restart | Go back 1 chunk |
| reset | Start from beginning |

## FLOW I: Play Urgent PDF

Requires x-webhook-secret header. Finds most urgent unlistened file, starts Flow C.

---

## TTS Fallback Chain

| Priority | Engine | Voice |
|----------|--------|-------|
| 1 | OpenAI TTS | alloy |
| 2 | Edge TTS | en-US-AndrewMultilingualNeural |
| 3 | espeak-ng | Default English |

## Known Issues & Learnings (Nest Speaker)

1. Nest state is unreliable — trust the service call, not the reported state
2. Nest CAN play from deployed app URL (/api/tts-audio/ excluded from auth)
3. Circuit breaker must not fire on state-check failures
4. Volume levels: Prompts=0.35, HA Voice=0.45, Playback=0.75, Fallback=0.35
5. Confirm TTS plays on Nest (not HA Voice) using generated audio
6. Stale sessions: 3+ min at chunk 0, or 10+ min at any chunk

## Background Processes

| Process | Interval | What It Does |
|---------|----------|--------------|
| Audio Preparation | 30 min | Pre-generates TTS for upcoming files |
| Semester Auto-Activation | 6 hours | Activates current semester |
| Ticker Push to HA | 5 min | Weather, news, pollen to HA sensors |
| Toothbrush Polling | 3 sec (playback only) | Auto-stop if brushing |
| Reminder Scheduler | 60 sec | Echo announcements + push notifications |
| Session Persistence | Every chunk | Saves state for resume after restart |

---
---

# PART 7: MAKING QUICK CHANGES TO THE APP

---

## How to Make a Quick Change (Step by Step)

### On Replit

1. Open the project in Replit
2. Find the file (see "Where to Find Things" below)
3. Make your edit
4. Save (Ctrl+S) — app auto-restarts
5. Check the preview
6. Done! Changes are live immediately

### On Self-Hosted Pi

1. SSH in: ssh pi@dashboard-server.local
2. Navigate: cd /opt/dashboard
3. Edit the file: nano server/routes.ts
   (In nano: Ctrl+W to search, Ctrl+X to save and exit)
4. Rebuild: npm run build
5. Restart: sudo systemctl restart dashboard
6. Check: sudo systemctl status dashboard
7. If broken: sudo journalctl -u dashboard -n 50 --no-pager

### Using VS Code Remote (Much Easier Than nano)

1. Install VS Code on your computer (free: code.visualstudio.com)
2. Install the "Remote - SSH" extension
3. Ctrl+Shift+P > "Remote-SSH: Connect to Host" > pi@dashboard-server.local
4. Now you can browse and edit Pi files with full VS Code features
5. Open integrated terminal (Ctrl+`) for build/restart commands

### Quick Change Checklist

[ ] Find the right file
[ ] Make the edit
[ ] Save the file
[ ] Rebuild (npm run build) — Pi only, Replit auto-rebuilds
[ ] Restart (sudo systemctl restart dashboard) — Pi only
[ ] Test in browser
[ ] Check logs if something broke

---

## Common Quick Changes

Change a TTS voice message:
  File: server/routes.ts
  Search for the message text you want to change

Change a color or style:
  File: client/src/index.css or the specific page file
  For Tailwind: change class names (bg-blue-500 > bg-green-500)

Change a timer or delay:
  File: server/routes.ts
  Common: 23000 (confirmation wait), 10 * 60 * 1000 (pause timeout)

Change volume levels:
  File: server/routes.ts
  Search for: volume_set or specific numbers (0.35, 0.45, 0.64, 0.75)

Add a new API endpoint:
  File: server/routes.ts
  Add inside registerRoutes function

Change dashboard layout:
  File: client/src/pages/dashboard.tsx

---

## Where to Find Things in the Code

| What to Change | File |
|----------------|------|
| Task behavior | server/routes.ts (search /api/tasks) |
| Calendar | server/googleCalendar.ts or server/outlookCalendar.ts |
| Spotify | server/spotify.ts + client/src/pages/spotify-player.tsx |
| Cat washroom / TTS | server/routes.ts (search cat-lights or cat-wash) |
| Dashboard UI | client/src/pages/dashboard.tsx |
| PDF reader | client/src/pages/pdf-reader.tsx |
| OneNote page | client/src/pages/onenote.tsx |
| Colors/theme | client/src/index.css |
| Database tables | shared/schema.ts |
| Database operations | server/storage.ts |
| Ticker/news | server/routes.ts (search ticker or news) |
| Reminders | server/reminderScheduler.ts |
| Email | server/email.ts |
| OneDrive sync | server/onedrive.ts |

How to search the codebase:
  On Replit: magnifying glass icon in left sidebar
  On Pi with VS Code Remote: Ctrl+Shift+F
  On Pi terminal: grep -rn "search text" --include="*.ts" server/

---
---

# PART 8: HOW TO SPLIT routes.ts INTO TWO FILES

---

## Why Split?

server/routes.ts is ~17,000 lines. Splitting into two files makes it easier to navigate and edit. After splitting, the app works exactly the same.

Result:
  server/routes.ts — Main app (~9,800 lines)
  server/catWashRoutes.ts — Cat washroom + media + webhooks (~7,400 lines)

---

## Step-by-Step Split Instructions

Step 1: Find the split point. Search for SERVER_START_TIME in routes.ts. Everything from there down is cat washroom code.

Step 2: Create server/catWashRoutes.ts with imports:
```
import type { Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { getWeekNumber, type FileRecord, appState, announcements } from "@shared/schema";
import { z } from "zod";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { textToSpeech } from "./replit_integrations/audio/client";
import { sendEchoVoiceAnnouncement } from "./email";
import { listOneDriveItems, getOneDriveFile, getOneDriveItemByPath } from "./onedrive";
import * as spotifyApi from "./spotify";
import { torontoDate, torontoNow } from "./timezone";
```

Step 3: Copy the HA entity constants into the new file (or create server/constants.ts)

Step 4: Copy helper functions: haFetch, haServiceCall, haServiceCallSafe, generateAndSaveTTSAudio, cleanTextForTTS, etc.

Step 5: Create the export function:
```
export function registerCatWashRoutes(app: Express) {
  -- PASTE everything from SERVER_START_TIME to the end
}
```

Step 6: In routes.ts, add at top:
```
import { registerCatWashRoutes } from "./catWashRoutes";
```
Add at end of registerRoutes:
```
registerCatWashRoutes(app);
```

Step 7: Save, rebuild, restart. Fix "Cannot find name" errors by copying missing functions.

---
---

# PART 9: TESTING WITH HOME ASSISTANT (2025+ INTERFACE)

---

## How to Test Webhooks and Services in HA

IMPORTANT: In recent HA versions (2024.x+), the "Services" tab under Developer Tools has been renamed to "Actions". Same functionality, just a different name.

### Where to Find It

1. Open HA in your browser
2. Click Developer Tools (wrench icon in sidebar)
3. Click the "Actions" tab (this used to be called "Services")

### Testing a REST Command

1. Developer Tools > Actions
2. In "Action" dropdown, search for your rest_command (e.g., rest_command.cat_lights_webhook)
3. Click "Perform Action" (this button used to say "Call Service")
4. Check your app logs for the webhook

### Controlling a Speaker or Device

1. Developer Tools > Actions
2. Search for the service:
   - media_player.play_media — play audio
   - media_player.volume_set — set volume
   - media_player.media_stop — stop playback
   - light.turn_on / light.turn_off — control lights
   - input_boolean.turn_on / input_boolean.turn_off — toggle booleans

3. Fill in service data:

   Play audio on Nest speaker:
   ```
   entity_id: media_player.bathroom_speaker
   media_content_id: "https://your-app-url/api/tts-audio/test.mp3"
   media_content_type: "music"
   ```

   Set volume:
   ```
   entity_id: media_player.bathroom_speaker
   volume_level: 0.5
   ```

4. Click "Perform Action"

### Checking Entity States

1. Developer Tools > States
2. In the filter box, type the entity name (e.g., light.cat_lights)
3. See current state (on, off, playing, etc.) and attributes

### Testing an Automation

1. Settings > Automations & Scenes
2. Find your automation
3. Click three dots on the right > "Run"
4. Check app logs

### Testing from Command Line (Bypassing HA)

```
-- Test cat lights webhook
curl -X POST http://localhost:5000/api/webhook/cat-lights \
  -H "Content-Type: application/json" \
  -d '{"state": "on"}'

-- Test voice command
curl -X POST http://localhost:5000/api/webhook/voice-command \
  -H "Content-Type: application/json" \
  -d '{"command": "pause"}'

-- Test cat volume
curl -X POST http://localhost:5000/api/webhook/cat-volume \
  -H "Content-Type: application/json" \
  -d '{"direction": "up", "speed": "normal"}'
```

### Checking HA Logs

Settings > System > Logs. Search for "rest_command" or your automation name.

### Quick HA Testing Cheat Sheet

| What to Test | Where | What to Do |
|-------------|-------|------------|
| Trigger automation | Settings > Automations | Three dots > Run |
| Call REST command | Developer Tools > Actions | Search rest_command.xxx > Perform Action |
| Control speaker | Developer Tools > Actions | Search media_player > fill data > Perform Action |
| Check entity state | Developer Tools > States | Search entity name |
| View HA logs | Settings > System > Logs | Search for errors |
| Test webhook directly | Terminal | curl commands (see above) |

---
---

# PART 10: TROUBLESHOOTING

---

## ChatGPT Introduction Statement

Copy this ENTIRE block first, every time you ask ChatGPT for help. Then add your problem at the end:

```
I am self-hosting a full-stack academic task management web application on a Raspberry Pi 5 (8GB RAM) running Raspberry Pi OS Lite (64-bit, no desktop environment).

The app is built with:
- Backend: Node.js 20 + Express.js + TypeScript
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui components
- Database: PostgreSQL (local, on the same Pi)
- ORM: Drizzle ORM (schema defined in shared/schema.ts, pushed with "npm run db:push")
- Build: "npm run build" compiles TypeScript and bundles frontend. Production runs with "node dist/index.js" on port 5000.
- Process Manager: systemd service called "dashboard" (user "pi", working directory /opt/dashboard)

The app integrates with:
- Home Assistant (REST API, long-lived access token) for smart home, speakers, sensors
- Google Calendar API (OAuth 2.0) for calendar events
- Gmail API (OAuth 2.0) for email processing
- Spotify Web API (OAuth 2.0) for music playback
- Microsoft Graph API (OAuth 2.0) for OneDrive files and Outlook calendar
- OpenAI TTS API for text-to-speech (Edge TTS and espeak-ng as fallbacks)

The app has a "cat washroom study reading system" that:
- Converts PDFs to text, chunks them, generates TTS audio
- Plays on Google Nest speaker via HA media_player service
- Syncs text display on Fire Tablet and Samsung TV via Fire Stick
- Triggered by HA webhooks (light switches, buttons, voice commands)
- Endpoints: /api/webhook/cat-lights, /api/webhook/voice-command, etc.

The app serves both API and React frontend from Express on port 5000.

Main server file: server/routes.ts (~17,000 lines). Database schema: shared/schema.ts. Frontend: client/src/App.tsx.

Environment variables in /opt/dashboard/.env loaded via systemd EnvironmentFile.

IMPORTANT:
- OneNote notebook listing uses OneDrive file scanning (NOT OneNote Graph API). Scans /Documents/Bryn's Notebook and /School/1. TMU/Notebook for .one files.
- All dates use America/Toronto timezone via server/timezone.ts.
- Designed for 1920x720 touchscreen.

Here is my problem:
```

---

## Section-by-Section Troubleshooting

### Flashing the OS
- Imager won't detect card: Try different USB port, reader, check lock switch
- Verification failed: Re-download imager, try different card

### First Boot / SSH
- Connection refused: Wait 5 min, check ethernet, find IP in router admin
- Permission denied: Use Imager password, not "raspberry"

### System Dependencies
- Wrong Node version: Remove old, re-run NodeSource setup
- pip install fails: Add --break-system-packages flag

### PostgreSQL
- Connection refused: sudo systemctl start postgresql && sudo systemctl enable postgresql
- Peer auth failed: Edit pg_hba.conf, change peer to md5, restart PostgreSQL

### npm install
- Out of memory: Create swap file (sudo fallocate -l 2G /swapfile)
- Permission errors: sudo chown -R pi:pi /opt/dashboard
- Hangs forever: Normal on Pi (5-10 min). Ctrl+C and retry after 15 min.

### Build Errors
- TypeScript errors: npm run build 2>&1 | head -50 — fix from top down
- Out of memory: export NODE_OPTIONS="--max-old-space-size=4096"

### App Won't Start
- Crashes: Check PostgreSQL running, .env exists, port free (sudo fuser -k 5000/tcp)
- Blank page: Run npm run build. Check ls dist/public/ has files.

### systemd Service
- Won't start: Check paths in service file. Run sudo systemctl daemon-reload.
- Keeps restarting: sudo journalctl -u dashboard -f to see crash error

### OAuth Issues
- redirect_uri_mismatch: URI must EXACTLY match in Google/Azure console
- invalid_grant: Refresh token expired — redo OAuth flow
- Insufficient privileges: Add missing API permissions

---

## General: App Crashes / Won't Start

Quick checklist:
```
sudo systemctl status postgresql
sudo systemctl status dashboard
sudo journalctl -u dashboard -n 100 --no-pager
cd /opt/dashboard && node dist/index.js
sudo fuser 5000/tcp
cat /opt/dashboard/.env | head -5
ls /opt/dashboard/node_modules | head -5
ls -la /opt/dashboard/dist/index.js
```

## General: Database Issues

```
-- Tables missing:
npm run db:push

-- Schema out of sync (back up first!):
pg_dump -U dashboard dashboard_db > backup.sql
npm run db:push --force

-- Can't connect:
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Quick Reference: Useful Commands

| What | Command |
|------|---------|
| Check app | sudo systemctl status dashboard |
| Live logs | sudo journalctl -u dashboard -f |
| Last 100 logs | sudo journalctl -u dashboard -n 100 --no-pager |
| Restart | sudo systemctl restart dashboard |
| Stop | sudo systemctl stop dashboard |
| Start | sudo systemctl start dashboard |
| Check PostgreSQL | sudo systemctl status postgresql |
| Disk space | df -h |
| Memory | free -h |
| Check port | sudo fuser 5000/tcp |
| Kill port | sudo fuser -k 5000/tcp |
| Back up DB | pg_dump -U dashboard dashboard_db > backup.sql |
| Rebuild | npm run build |
| Update schema | npm run db:push |
| Pi temperature | vcgencmd measure_temp |
| CPU usage | top -bn1 |

---
---

# PART 11: ONGOING MAINTENANCE

---

## Viewing Logs
```
sudo journalctl -u dashboard -f              -- Live
tail -100 /var/log/dashboard.log             -- Last 100 lines
tail -100 /var/log/dashboard-error.log       -- Errors only
```

## Restarting the App
```
sudo systemctl restart dashboard
```

## Updating the Code
```
cd /opt/dashboard
-- Transfer new code (scp or git pull)
npm install
npm run build
sudo systemctl restart dashboard
```

## Backing Up the Database
```
pg_dump -U dashboard dashboard_db > /opt/dashboard/backup_$(date +%Y%m%d).sql
```

## Restoring a Backup
```
psql -U dashboard dashboard_db < /opt/dashboard/backup_YYYYMMDD.sql
```

## Key Differences from Replit

| Feature | Replit | Self-Hosted Pi |
|---------|--------|---------------|
| OAuth | Managed automatically | You manage tokens manually |
| HTTPS | Automatic | Use Cloudflare Tunnel if needed |
| Uptime | Replit manages | You manage power, updates, SD card |
| External Webhooks | Public URL available | Need tunnel for cloud services |
| Database Backups | Replit handles | Set up cron jobs |
| Speed | Cloud latency to HA | Local network — faster |

## Estimated Migration Effort

| Task | Time |
|------|------|
| Hardware + OS flash | 30 min |
| System dependencies | 20 min |
| Code transfer + DB init | 15 min |
| Google OAuth | 1-2 hours |
| Spotify OAuth | 30 min |
| Microsoft OAuth | 1-2 hours |
| HA webhook updates | 30 min |
| Testing | 1-2 hours |
| Total | 4-7 hours |

---
---

# PART 12: CHATGPT PROMPT TEMPLATES

Always start with the Introduction Statement from Part 10, then add one of these:

---

For OAuth Issues:
```
I'm setting up OAuth 2.0 for [Google/Microsoft/Spotify]. I've rewritten getAccessToken() to use direct refresh token flow.

When I try to [action], I get: [paste error].

Environment variables: CLIENT_ID [present/missing], CLIENT_SECRET [present/missing], REFRESH_TOKEN [present/missing].
Token URL: [paste]. Scopes: [list].
```

For Token Exchange:
```
Exchanging OAuth code for tokens. Service: [Google/Microsoft/Spotify]. Client ID: present. Authorization code: present. Redirect URI: [exact URI].

Response: [paste]. Curl command (redacted): [paste].
```

For Expired Token:
```
My [Google/Microsoft/Spotify] refresh token stopped working. Error: [paste].
Was working [when]. I [did/didn't] revoke access or change secret.
How do I get a new refresh token?
```

For Connector Rewrite:
```
I need to rewrite auth in [file] to work without Replit connectors. Current code:
[paste first 60 lines]
Need direct OAuth 2.0 with env vars. Rewrite only the auth function.
```

For Build Errors:
```
Built on Pi 5 with "npm run build". [Succeeded/Failed: paste errors].
When running "node dist/index.js": [crashes with: paste / starts but: describe].
```

For systemd:
```
systemd service at /etc/systemd/system/dashboard.service. When started: [describe].
Status: [paste output]. Journal: [paste last 50 lines].
```

For HA Webhooks:
```
Connecting HA at [URL] to app at http://[Pi]:5000. When triggering [automation]: [describe].
REST commands: [paste yaml]. App logs: [paste].
```

For Database:
```
PostgreSQL on Pi 5. DB: dashboard_db, user: dashboard, ORM: Drizzle.
When app tries to [action]: [paste error]. PostgreSQL: [running/not]. Manual connect: [works/fails].
```

For Cat Washroom / TTS:
```
Cat washroom not working. When I [trigger]: [describe vs expected].
Logs: [paste lines with [Cat Lights] or [Shower Button]].
Entities: bathroom_speaker, voice_097c38, fire_tv_172_24_0_88, tv_cat_wr, cat_washroom_media_group.
```

For Code Changes:
```
I want to change [what] in my dashboard. Backend: server/routes.ts (~17K lines). Frontend: client/src/pages/dashboard.tsx.
Current code: [paste 20-50 lines]. I want: [describe].
```

For Google Apps Script:
```
Apps Script sends webhooks to my app. Moved from Replit (public URL) to Pi at http://192.168.x.x:5000. Script can't reach Pi. Want [Cloudflare Tunnel/port forwarding]. I [do/don't] have a domain.
```

For Object Storage:
```
Need to replace Replit Object Storage with local filesystem on Pi. App uses it for:
1. PDF uploads (/api/course-week-upload)
2. TTS audio files (/api/tts-audio/)
Replace with fs operations in /opt/dashboard/uploads/. Keep /api/tts-audio/ working for Nest speaker.
```

---
---

# GLOSSARY

| Term | What It Means |
|------|---------------|
| API | Application Programming Interface — how programs talk to each other |
| API Key | Password-like string identifying your app to a service |
| Array | An ordered list of items |
| Async/Await | JavaScript way of handling time-consuming operations |
| Backend | Server-side code (data, databases, API calls) |
| Bash | Command-line language for Mac/Linux/servers |
| Boolean | true or false value |
| Build | Converting source code to optimized production files |
| CLI | Command Line Interface — text-based computer interaction |
| Component | Reusable piece of UI in React |
| CRUD | Create, Read, Update, Delete — basic database operations |
| CSS | Controls how web pages look (colors, layout, fonts) |
| Database | Permanent data storage (your filing cabinet) |
| Dependency | Package your app needs to work |
| DOM | Browser's internal page representation |
| Drizzle | ORM that translates TypeScript to SQL |
| Edge TTS | Microsoft's free text-to-speech (fallback) |
| Endpoint | Specific URL the server responds to |
| Environment Variable | Setting stored outside code (in .env file) |
| Express | Node.js web server framework |
| Fetch | JavaScript function for HTTP requests |
| Flexbox | CSS layout system for rows/columns |
| Frontend | Client-side code running in the browser |
| Function | Reusable code block |
| Git | Version control tracking code changes |
| GitHub | Website hosting Git repositories |
| Grep | Search tool for file contents |
| HA | Home Assistant |
| HTML | Structure/skeleton of web pages |
| HTTP | How browsers and servers communicate |
| JSON | Data format: {"key": "value"} |
| JSX | React's HTML-like syntax in JavaScript |
| Middleware | Code between request and response (auth, logging) |
| Node.js | JavaScript runtime for servers |
| npm | Node Package Manager |
| OAuth | Standard for app access without sharing passwords |
| Object | Collection of key-value pairs |
| ORM | Translates between code objects and database tables |
| Package | Reusable code bundle from others |
| PostgreSQL | Free, powerful database |
| Props | Properties passed to React components |
| Query | Request to database for data |
| React | Library for building UIs with components |
| Refresh Token | Long-lived token for getting new access tokens |
| REST | API pattern using HTTP methods |
| Route | URL pattern mapped to handler function |
| SCP | Secure file copy between computers |
| Scope | OAuth: permissions requested. Code: variable accessibility |
| SQL | Language for talking to databases |
| SSH | Remote terminal connection to another computer |
| State | React data that triggers re-renders when changed |
| String | Text value in quotes |
| systemd | Linux service manager (start/stop/auto-restart) |
| Tailwind CSS | CSS framework using class name shortcuts |
| Template Literal | String with backticks for embedded variables |
| Terminal | Text-based command interface |
| Token | String proving identity or granting access |
| TTS | Text-to-Speech |
| TypeScript | JavaScript with type safety (.ts/.tsx files) |
| URL | Web address |
| Variable | Named container holding a value |
| Vite | Frontend build tool |
| Webhook | URL another service calls to notify your app |
| YAML | Configuration file format (used by HA) |

---

End of Master App Guide
