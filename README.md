# Code To Prompt

Transform your code into AI-ready prompts! This VS Code extension helps you easily convert your codebase into structured prompts for Large Language Models (LLMs).

<img src="assets/logo.png" width="200" alt="Code To Prompt">

## Features

- 📁 **Interactive File Explorer**: Browse and select files through a dedicated sidebar view
- ✨ **Smart File Filtering**: Automatically excludes common asset files and folders (like images, node_modules, etc.)
- 📊 **Token Count**: Real-time token counting using tiktoken for GPT-4 compatibility
- 🎯 **Selective Code Export**: Choose specific files or entire folders to include in your prompt
- 📝 **LLM-Friendly Format**: Automatically formats your code with clear file separators and paths
- 📋 **One-Click Copy**: Easily copy the formatted code to your clipboard
- ⚙️ **Customizable Separators**: Modify the file separators to match your preferred format

## Installation

1. Open VS Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "Code To Prompt"
4. Click Install

## Usage

1. Open the Code To Prompt Explorer in the activity bar (look for the extension icon)
2. Browse through your project files in the explorer view
3. Check/uncheck files or folders you want to include in your prompt
4. The selected files will be formatted automatically with:
   - File paths as comments
   - Customizable separators between files
   - Token count for each file
5. Click the copy icon to copy the formatted code to your clipboard
6. Paste directly into your favorite LLM!

## Customization

- Click the settings icon (⚙️) in the explorer view to customize the separator between files
- Default separator is "====="

## Tips

- The extension automatically excludes common asset folders and files (images, fonts, etc.)
- Token counts are calculated using the GPT-4 tokenizer for accurate estimation
- Use folder selection to quickly include/exclude multiple files
- The extension maintains your selection state even when the view is hidden

## Requirements

- VS Code version 1.97.0 or higher

## Contributing

Found a bug or have a feature request? Please open an issue on our [GitHub repository](https://github.com/yourusername/code-to-prompt).

## License

This extension is licensed under the [MIT License](LICENSE).

---

**Note**: This extension is designed to help developers create better prompts for AI models. It does not send any of your code to external services - all processing is done locally.
