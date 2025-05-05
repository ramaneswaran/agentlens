import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";
import { extractUniqueTools } from "../../utils/dataProcessing";
import { Card, Row, Col, Badge } from "react-bootstrap";

const EXTENDED_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Custom Badge component to ensure styling is applied
const ColoredBadge = ({ color, children }) => (
  <span 
    className="badge rounded-pill" 
    style={{ 
      backgroundColor: color, 
      color: "#fff",
      fontSize: '0.9rem',
      padding: '0.5rem 0.8rem',
      margin: '0.2rem',
      display: 'inline-block',
      fontWeight: '500'
    }}
  >
    {children}
  </span>
);

function ToolFlowTab() {
  const [sankeyData, setSankeyData] = useState(null);
  const [uniqueTools, setUniqueTools] = useState([]);
  const [toolColorMap, setToolColorMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch("/agent_metrics.csv")
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        // Extract unique tools for consistent color mapping
        const tools = extractUniqueTools(parsed);
        setUniqueTools(tools);
        
        // Create a consistent color map
        const colorMap = {};
        tools.forEach((tool, index) => {
          colorMap[tool] = EXTENDED_COLORS[index % EXTENDED_COLORS.length];
        });
        
        setToolColorMap(colorMap);
        console.log("Tool color map created:", colorMap); // Debugging
        
        // Prepare Sankey data
        const sankey = prepareSankeyData(parsed, colorMap);
        setSankeyData(sankey);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error loading or parsing CSV:", error);
        setIsLoading(false);
      });
  }, []);

  // Custom Sankey data preparation function
  const prepareSankeyData = (data, colorMap) => {
    const toolSet = new Set();
    const nodeIndexMap = new Map(); // maps "tool @ step" => node index
    const nodes = [];
    const links = [];
    let nodeId = 0;

    // Group data by subdir
    const groupedByUseCase = {};
    data.forEach(row => {
      if (!row.subdir || !row.tool_name || row.step === undefined) return;

      toolSet.add(row.tool_name);

      if (!groupedByUseCase[row.subdir]) {
        groupedByUseCase[row.subdir] = [];
      }
      groupedByUseCase[row.subdir].push(row);
    });

    Object.entries(groupedByUseCase).forEach(([subdir, rows]) => {
      // Steps used by this subdir
      const steps = [...new Set(rows.map(r => r.step))].sort((a, b) => a - b);
      const stepMap = {};
      steps.forEach(step => {
        stepMap[step] = [...new Set(rows.filter(r => r.step === step).map(r => r.tool_name))];
      });

      const stepCount = steps.length;

      // Add nodes and links
      steps.forEach((step, i) => {
        const normalizedX = i / (stepCount - 1 || 1);  // avoid divide by 0

        stepMap[step].forEach(tool => {
          const key = `${tool} @ Step ${step}`;
          if (!nodeIndexMap.has(key)) {
            nodeIndexMap.set(key, nodeId);
            nodes.push({ 
              name: key, 
              tool, 
              step, 
              x: normalizedX
            });
            nodeId++;
          }
        });

        if (i < steps.length - 1) {
          const fromStep = step;
          const toStep = steps[i + 1];

          stepMap[fromStep].forEach(fromTool => {
            stepMap[toStep].forEach(toTool => {
              const source = nodeIndexMap.get(`${fromTool} @ Step ${fromStep}`);
              const target = nodeIndexMap.get(`${toTool} @ Step ${toStep}`);
              if (source != null && target != null) {
                const existing = links.find(l => l.source === source && l.target === target);
                if (existing) {
                  existing.value += 1;
                } else {
                  links.push({ source, target, value: 1 });
                }
              }
            });
          });
        }
      });
    });

    const nodeX = nodes.map(n => n.x);
    const maxStep = Math.max(...nodes.map(n => n.step || 0), 1);

    return {
      nodes,
      links,
      toolColors: colorMap,
      stepCount: maxStep,
      nodeX
    };
  };

  // Display loading state
  if (isLoading) return <div className="p-4">Loading Sankey diagram...</div>;
  
  // Handle case when data is loaded but empty
  if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
    return <div className="p-4">No data available for visualization.</div>;
  }

  const { nodes, links, toolColors, stepCount, nodeX } = sankeyData;

  // Create customdata arrays for hover information
  const nodeCustomdata = nodes.map(n => ({ tool: n.tool, step: n.step }));
  const nodeLabels = nodes.map(n => n.tool); // Use tool name for the node label
  const nodeColors = nodes.map(n => toolColors[n.tool] || "#888");

  const stepLabels = Array.from({ length: stepCount }, (_, i) => `Step ${i + 1}`);
  const xTickVals = Array.from({ length: stepCount }, (_, i) => i / (stepCount - 1));

  // Construct custom hover tooltips for links
  const linkCustomdata = links.map(l => {
    const sourceNode = nodes[l.source];
    const targetNode = nodes[l.target];
    return {
      sourceLabel: sourceNode.name,
      targetLabel: targetNode.name,
      sourceTool: sourceNode.tool,
      targetTool: targetNode.tool,
      sourceStep: sourceNode.step,
      targetStep: targetNode.step
    };
  });

  return (
    <Card className="p-4">
      <h5 className="mb-3">Tool Flow Sankey</h5>

      {/* APPROACH 1: Custom Badge Component */}
      <div className="mb-4">
        <h6 className="text-muted mb-2">Tool Legend:</h6>
        {uniqueTools.map(tool => (
          <ColoredBadge key={tool} color={toolColors[tool]}>
            {tool}
          </ColoredBadge>
        ))}
      </div>

      {/* APPROACH 2: Direct DOM element with enforced styling */}
      {/*
      <div className="mb-4">
        <h6 className="text-muted mb-2">Tool Legend (Alternative):</h6>
        {uniqueTools.map(tool => (
          <span 
            key={tool}
            style={{
              backgroundColor: toolColors[tool] || '#888',
              color: 'white',
              borderRadius: '50px',
              padding: '6px 12px',
              margin: '0 4px 8px 0',
              display: 'inline-block',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            {tool}
          </span>
        ))}
      </div>
      */}

      {/* APPROACH 3: Using the className directly for more control */}
      {/*
      <div className="mb-4">
        <h6 className="text-muted mb-2">Tool Legend (CSS Classes):</h6>
        <style>
          {uniqueTools.map((tool, index) => (`
            .tool-badge-${index} {
              background-color: ${toolColors[tool]} !important;
              color: white !important;
            }
          `)).join('\n')}
        </style>
        
        {uniqueTools.map((tool, index) => (
          <Badge 
            key={tool}
            pill
            className={`tool-badge-${index} me-2 mb-2`}
            style={{
              fontSize: '0.9rem',
              padding: '0.4rem 0.7rem'
            }}
          >
            {tool}
          </Badge>
        ))}
      </div>
      */}

      <div style={{ width: '100%', height: 700 }}>
        <Plot
          data={[
            {
              type: 'sankey',
              orientation: 'h',
              node: {
                label: nodeLabels,
                color: nodeColors,
                pad: 15,
                thickness: 24,
                line: { color: 'black', width: 0.5 },
                x: nodeX,
                customdata: nodeCustomdata,
                hovertemplate: 'Tool: %{customdata.tool}<br>Step: %{customdata.step}<extra></extra>'
              },
              link: {
                source: links.map(l => l.source),
                target: links.map(l => l.target),
                value: links.map(l => l.value),
                customdata: linkCustomdata,
                hovertemplate:
                  'From: %{customdata.sourceTool} (Step %{customdata.sourceStep})<br>' +
                  'To: %{customdata.targetTool} (Step %{customdata.targetStep})<br>' +
                  'Count: %{value}<extra></extra>',
                color: 'rgba(100,100,100,0.2)'
              },
            },
          ]}
          layout={{
            title: 'Tool transitions across Agentic Steps',
            font: { size: 12 },
            height: 700,
            width: 1200,  // Make it wider
            autosize: true,
            margin: { t: 80, l: 30, r: 30, b: 80 },
            xaxis: {
              tickvals: xTickVals,
              ticktext: stepLabels,
              showticklabels: true,
              showgrid: false,
              zeroline: false
            },
            annotations: xTickVals.map((x, i) => ({
              x,
              y: -0.1,
              xref: 'paper',
              yref: 'paper',
              text: stepLabels[i],
              showarrow: false,
              font: { size: 14 }
            }))
          }}
          config={{ 
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'tool_flow_sankey',
              height: 700,
              width: 1200,
              scale: 2
            }
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </Card>
  );
}

export default ToolFlowTab;