import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";
import { prepareSankeyData } from "../../utils/dataProcessing";
import { Card, Row, Col, Badge } from "react-bootstrap";

function ToolFlowTab() {
  const [sankeyData, setSankeyData] = useState(null);

  useEffect(() => {
    fetch("/agent_metrics.csv")
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        const sankey = prepareSankeyData(parsed);
        setSankeyData(sankey);
      });
  }, []);

  if (!sankeyData) return <div className="p-4">Loading Sankey...</div>;

  const { nodes, links, toolColors, stepCount, nodeX } = sankeyData;

  // Hide cluttered labels (leave empty strings)
  const nodeLabels = Array(nodes.length).fill('');
  const nodeColors = nodes.map(n => toolColors[n.tool] || "#888");

  const stepLabels = Array.from({ length: stepCount }, (_, i) => `Step ${i + 1}`);
  const xTickVals = Array.from({ length: stepCount }, (_, i) => i / (stepCount - 1));

  // Construct custom hover tooltips
  const sourceLabels = links.map(l => nodes[l.source].name);
  const targetLabels = links.map(l => nodes[l.target].name);
  const linkCustomData = sourceLabels.map((source, i) => ({
    source,
    target: targetLabels[i]
  }));

  return (
    <Card className="p-4">
      <h5 className="mb-3">Tool Flow Sankey</h5>

      <Row className="mb-4">
        {Object.entries(toolColors).map(([tool, color]) => (
          <Col xs="auto" key={tool} className="mb-1">
            <Badge pill style={{ backgroundColor: color, color: "#fff" }}>
              {tool}
            </Badge>
          </Col>
        ))}
      </Row>

      <div style={{ width: '100%', height: 700 }}>
        <Plot
          data={[
            {
              type: 'sankey',
              orientation: 'h',
              node: {
                label: nodeLabels,
                color: nodeColors,
                pad: 20,
                thickness: 24,
                line: { color: 'black', width: 0.5 },
                x: nodeX
              },
              link: {
                source: links.map(l => l.source),
                target: links.map(l => l.target),
                value: links.map(l => l.value),
                customdata: linkCustomData,
                hovertemplate:
                  '%{customdata.source} → %{customdata.target}<br>Count: %{value}<extra></extra>',
                color: 'rgba(100,100,100,0.2)'
              },
            },
          ]}
          layout={{
            title: 'Tool transitions across Agentic Steps',
            font: { size: 12 },
            height: 700,
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
          config={{ responsive: true }}
        />
      </div>
    </Card>
  );
}

export default ToolFlowTab;
