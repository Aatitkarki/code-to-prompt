# Code to Prompt

<p align="center">
  <img src="media/logo.png" width="200" alt="Code to Prompt logo" />
  <br />
  <strong>Turn your codebase into LLM-ready context in one click.</strong>
</p>

Transform your project into clean, structured prompts for ChatGPT, Claude, Copilot, DeepSeek and more — directly from VS Code.

---

## ✨ What it does

**Code to Prompt** lets you:

- Browse your workspace in a dedicated **Files** view
- Select exactly the files/folders you want (no `node_modules`, no binaries, no secrets by mistake)
- See **live token estimates** for the combined prompt
- Format everything into a single, structured block (Markdown, XML or JSON)
- Add **header/footer instructions** so the AI knows what to do and how to respond
- Copy the result with **one click** — from the sidebar or from a full-screen dashboard
- Optionally **import the AI’s reply back into your workspace**, creating/updating files safely

All processing happens locally inside VS Code. Nothing is sent anywhere.

---

## 🚀 Key Features

### 📁 Smart Files Sidebar

- **Interactive tree view** in its own activity bar icon
- **Click to select / deselect** files and folders
- **Folder toggle** selects/deselects all eligible files inside
- **Select open editors** with one command
- **Reset selection** with a single button
- **Reload files** to pick up new / deleted files on disk

### 🧠 Git-aware, noise-free selection

- **Respects `.gitignore`** by default so you don’t accidentally include:
  - `node_modules/`
  - build output
  - other ignored junk
- Additional **ignore patterns** (e.g. `*.log`, `dist/`, `*.tmp`) configurable in settings
- Built-in **binary guard** to skip images, archives, executables, PDFs, lock files, etc.

### 🧩 Multiple prompt formats

Choose the format that matches your LLM:

- **Markdown** (default)
  - `File: path/to/file.ts` header
  - Language-tagged fenced code blocks
  - Optional project **tree summary** at the top
- **XML**
  - `<documents>` with one `<document path="...">` per file
  - Code is dedented on import so Python/whitespace-sensitive languages stay valid
- **JSON**
  - `{ "documents": [ { "path": "...", "content": "..." } ], "tree": "..." }`

You can switch format at any time in the **Settings** view.

### 🧮 Token-aware prompts

- **Live token count** for the full prompt (using `tiktoken` when available, with a heuristic fallback)
- Configurable **token budget** (e.g. 8k, 32k, 128k)
- Warnings when your prompt goes over your chosen budget (in notifications and dashboard)

### 🧱 Dashboard view

A full-screen **Dashboard** command (`Code to Prompt: Open Dashboard`) gives you:

- **Selected files list** with:
  - Reordering via **↑ / ↓** buttons
  - File paths shown in the order they’ll appear in the prompt
- **Prompt preview** you can inspect and tweak
- **Include tree structure** toggle (for Markdown and JSON formats)
- **Token info & budget** always visible
- **Copy Prompt** and **Reset** buttons at the top

### 🧾 Header & footer prompts

Guide the model without re-typing the same instructions:

- **Header prompt** — text automatically inserted _before_ the files block  
  e.g.

  > “This is my current code. Help me fix the bug in X and refactor Y.”

- **Footer prompt** — text automatically inserted _after_ the files block  
  e.g.

  > “Return only updated files in the same format, no explanations.”

- Optional checkbox to append a **standard footer note**:
  > “Always output in same format as provided. Only provide new or files that requires update.”

This makes it easy to keep models like ChatGPT/Claude consistently returning `<documents>`, JSON, or `File:` blocks that you can re-import safely.

### 💾 Presets

Save and reuse your favorite selections:

- Create named **presets** (e.g. “Auth system”, “DB schema”, “API handlers”)
- Load a preset to instantly restore that selection
- Manage presets in the dedicated **Presets** view (save / load / delete)

### 📥 Import from AI output (round-trip workflow)

Code to Prompt supports a full **round-trip** workflow:

1. Generate a prompt from your files (Markdown / XML / JSON).
2. Send it to your LLM.
3. Copy the model’s reply.
4. Run **“Code to Prompt: Import Prompt from Clipboard”**.

The importer will:

- **Auto-detect format** (XML / JSON / Markdown) — no settings needed
- Parse all files the model returned
- Compare them against your workspace
- Classify:
  - **New files** (created)
  - **Updated files** (overwritten)
  - **Unchanged files** (ignored)

If **“Require confirmation before import”** is enabled (recommended):

- A modal summary shows:
  - New files count & sample names
  - Updated files count & sample names
- You confirm or cancel before anything is written.

After import:

- The file tree is reloaded
- A notification summarizes how many files were **created** and **updated**

---

## 📸 Screenshots

> Replace these with real images in your repo (`media/` or `assets/`):

- **Sidebar Files view**  
  `![Code to Prompt Files view](media/sidebar.png)`

- **Dashboard**  
  `![Code to Prompt Dashboard](media/dashboard.png)`

---

## 📥 Installation

1. Open **Visual Studio Code**
2. Go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **“Code to Prompt”**
4. Click **Install**

Or install the packaged `.vsix` from the command palette:  
**“Extensions: Install from VSIX…”**

---

## 🧑‍💻 Usage

### 1. Open the sidebar

- Click the **Code to Prompt** icon in the Activity Bar.
- You’ll see three views:
  - **Files** – selection + quick actions
  - **Settings** – output & ignore configuration
  - **Presets** – saved selections

### 2. Select files

In the **Files** view:

1. Expand folders and click items to toggle selection.
2. Click a folder to select / deselect all eligible files inside.
3. Use **“Select Open Editors”** to quickly add all currently open files.
4. Use the **Reset** icon to clear the selection.
5. Use the **Reload** icon if you’ve created / deleted files on disk and want to refresh the tree.
6. Use the **Copy** icon to copy a prompt directly from the sidebar (fast path).
7. Use the **Play** icon to open the full Dashboard.

### 3. Copy a prompt (fast path)

If you just want a prompt quickly:

1. Select your files in the **Files** view.
2. Click the **Copy** icon in the view title bar.
3. A formatted prompt (with your header/footer, if configured) is copied to your clipboard.
4. Paste it into ChatGPT / Claude / Copilot / DeepSeek.

### 4. Use the Dashboard (full control)

For more control:

1. Click the **Play** icon in the **Files** view title  
   or run the command: **“Code to Prompt: Open Dashboard”**.
2. In the dashboard:
   - Reorder files with the **↑ / ↓** buttons.
   - Toggle **“Include tree structure”** (Markdown/JSON).
   - Inspect the full prompt in the **Prompt Preview** panel.
   - Watch the **token count** & **budget** indicators.
3. Click **Copy Prompt** to copy the current preview to your clipboard.
4. Click **Reset** to clear the selection and start over.

### 5. Save a preset

1. In the **Files** view, select the files/folders you want.
2. Switch to the **Presets** view.
3. Give your preset a name (e.g. “Core app + routes”) and click **Save**.
4. Later, click **Load** on that preset to restore the same selection.

### 6. Import AI changes back into your project

1. Generate a prompt with Code to Prompt (Markdown / XML / JSON).
2. Send it to your LLM with your preferred instructions.
3. Copy the model’s reply (which should use the same format).
4. In VS Code, run **“Code to Prompt: Import Prompt from Clipboard”**.
5. Review the confirmation dialog (if enabled):
   - New files
   - Updated files
6. Click **Import** to apply changes.

> Tip: Use the footer / standard note so the model only returns **new or changed** files, in the same multi-file format.

---

## 🔧 Configuration

You can manage all settings via:

- The **Settings** view in the sidebar, or
- VS Code Settings (`Ctrl+,` / `Cmd+,`) → search for **“Code to Prompt”**

Available settings (summary):

| Setting                                  | Type    | Default      | Description                                                                                                           |
| ---------------------------------------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `codeToPrompt.defaultFormat`             | string  | `"markdown"` | Output format: `"markdown"`, `"xml"`, or `"json"`.                                                                    |
| `codeToPrompt.includeLineNumbers`        | boolean | `false`      | Add line numbers to each code block.                                                                                  |
| `codeToPrompt.includeTreeStructure`      | boolean | `false`      | Include a text tree of the selected files/folders (Markdown/JSON).                                                    |
| `codeToPrompt.respectGitignore`          | boolean | `true`       | Respect `.gitignore` rules when building the file tree.                                                               |
| `codeToPrompt.ignorePatterns`            | string  | `""`         | Extra ignore patterns (one per line, `.gitignore`-style).                                                             |
| `codeToPrompt.tokenBudget`               | number  | `32000`      | Token budget used for warnings in notifications and dashboard.                                                        |
| `codeToPrompt.headerPrompt`              | string  | `""`         | Optional text prepended above every generated prompt.                                                                 |
| `codeToPrompt.footerPrompt`              | string  | `""`         | Optional text appended after every generated prompt.                                                                  |
| `codeToPrompt.appendStandardFooterNote`  | boolean | `true`       | Append the standard note: “Always output in same format as provided. Only provide new or files that requires update”. |
| `codeToPrompt.requireImportConfirmation` | boolean | `true`       | Require a confirmation dialog listing new/updated files before importing from clipboard.                              |

---

## ⌨️ Commands

These commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **Code to Prompt: Open Dashboard** – show the full dashboard view
- **Code to Prompt: Copy Prompt** – copy the prompt for the current selection
- **Code to Prompt: Select Open Editors** – select all visible text editors
- **Code to Prompt: Reset Selection** – clear all selected files
- **Code to Prompt: Reload Files** – rebuild the file tree from disk
- **Code to Prompt: Import Prompt from Clipboard** – parse AI output (Markdown / XML / JSON) and create/update files

---

## 🔐 Privacy & Security

- All processing happens **locally** inside VS Code.
- Your code is **never** sent to external servers by this extension.
- Use `.gitignore` and the **ignore patterns** setting to avoid including sensitive files such as `.env` or secret keys in your prompts.
- The import feature only writes to files inside your workspace and can be protected by a confirmation dialog.

---

## 🤝 Contributing

Bugs, ideas, or feature requests are welcome!

1. Open an issue or discussion on the  
   [GitHub repository](https://github.com/aatitkarki/code-to-prompt) <!-- adjust URL if needed -->
2. Fork the repo
3. Create a feature branch
4. Submit a pull request

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE).
