# LLM Tool Visualization Platform

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MananSuri27/agentlens
   cd agentlens
   ```
2. Install NVM and Node.JS v22.15 (For MacOS)
   ```bash
    # Download and install nvm:
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

    # in lieu of restarting the shell
    \. "$HOME/.nvm/nvm.sh"

    # Download and install Node.js:
    nvm install 22

    # Verify the Node.js version:
    node -v # Should print "v22.15.0".
    nvm current # Should print "v22.15.0".

    # Verify npm version:
    npm -v # Should print "10.9.2".
   ```
3. Install dependencies:
   ```bash
   npm install
   npm install vite
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```



## Project Structure

```
agentlens-master/
├── .gitignore
├── README.md
├── downgrade.sh
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── vite.config.js
├── public/
│   ├── agent_metrics.csv       # CSV data file
│   └── vite.svg                # Vite logo asset
└── src/
    ├── App.css                 # Global styles for App
    ├── App.jsx                 # Main React component
    ├── assets/
    │   └── react.svg           # React logo asset
    ├── components/
    │   ├── Layout.jsx          # Page layout wrapper
    │   ├── SparklineBar.jsx    # Sparkline bar chart component
    │   ├── Tabs/
    │   │   ├── MetricsTab.jsx       # Metrics overview tab
    │   │   ├── ToolFlowTab.jsx      # Tool flow visualization tab
    │   │   └── ToolsTab.jsx         # List of tools tab
    │   └── ToolDetail.jsx      # Detailed view for a single tool
    ├── index.css               # Base CSS resets & utilities
    ├── main.jsx                # React entry point
    └── utils/
        ├── dataProcessing.js   # CSV/data parsing utilities
        └── plotlyHelpers.js    # Helpers for Plotly visualizations
```




# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
