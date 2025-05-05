// src/utils/plotlyHelpers.js

/**
 * Prepare boxplot data for Plotly visualization
 * @param {Array} data - The parsed CSV data
 * @param {Array} selectedTools - Array of tool names to include
 * @returns {Object} - Data structure ready for Plotly boxplot
 */
export const prepareBoxplotDataForPlotly = (data, selectedTools) => {
    // Arrays to store our boxplot data
    const traces = [];
    
    // Create separate traces for success and error cases
    selectedTools.forEach((tool, index) => {
      const toolData = data.filter(row => row.tool_name === tool);
      
      // Get success durations
      const successDurations = toolData
        .filter(row => !row.has_error)
        .map(row => row.duration);
      
      // Get error durations
      const errorDurations = toolData
        .filter(row => row.has_error)
        .map(row => row.duration);
      
      // Add success trace if we have data
      if (successDurations.length > 0) {
        traces.push({
          type: 'box',
          y: successDurations,
          name: `${tool} (Success)`,
          boxpoints: 'outliers',
          jitter: 0.3,
          pointpos: -1.5,
          boxmean: true,
          marker: {
            color: 'rgba(44, 160, 101, 0.7)'
          },
          line: {
            color: 'rgba(44, 160, 101, 1)'
          }
        });
      }
      
      // Add error trace if we have data
      if (errorDurations.length > 0) {
        traces.push({
          type: 'box',
          y: errorDurations,
          name: `${tool} (Error)`,
          boxpoints: 'outliers',
          jitter: 0.3,
          pointpos: -1.5,
          boxmean: true,
          marker: {
            color: 'rgba(255, 65, 54, 0.7)'
          },
          line: {
            color: 'rgba(255, 65, 54, 1)'
          }
        });
      }
    });
  
    // Layout configuration
    const layout = {
      title: 'Runtime Distribution by Tool',
      yaxis: {
        title: 'Duration (s)',
        zeroline: true
      },
      boxmode: 'group',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.2
      },
      margin: { 
        l: 60,
        r: 30,
        t: 50,
        b: 100 
      }
    };
    
    return { 
      data: traces,
      layout
    };
  };
  
  /**
   * Prepare heatmap data for Plotly visualization
   * @param {Array} data - The parsed CSV data
   * @param {Array} selectedTools - Array of tool names to include
   * @returns {Object} - Data structure ready for Plotly heatmap
   */
  export const prepareHeatmapDataForPlotly = (data, selectedTools) => {
    // Extract unique steps and ensure they're sorted
    const steps = [...new Set(data.map(row => row.step))]
      .filter(Boolean)
      .sort((a, b) => a - b);
    
    // Create 2D array for heatmap values (z)
    const zValues = [];
    const annotations = [];
    
    // Process data for each tool
    selectedTools.forEach((tool, toolIndex) => {
      const toolRow = [];
      
      steps.forEach((step, stepIndex) => {
        // Find data points for this tool and step
        const filteredData = data.filter(row => 
          row.tool_name === tool && row.step === step
        );
        
        if (filteredData.length > 0) {
          // Calculate average duration
          const avgDuration = filteredData.reduce(
            (sum, row) => sum + (row.duration || 0), 0
          ) / filteredData.length;
          
          const durationValue = parseFloat(avgDuration.toFixed(3));
          toolRow.push(durationValue);
          
          // Add annotation
          annotations.push({
            x: stepIndex,
            y: toolIndex,
            text: durationValue.toFixed(3),
            font: {
              color: durationValue > 1 ? 'white' : 'black'
            },
            showarrow: false
          });
        } else {
          // No data for this combination
          toolRow.push(null);
        }
      });
      
      zValues.push(toolRow);
    });
    
    // Prepare the heatmap trace
    const trace = {
      z: zValues,
      x: steps.map(step => `Step ${step}`),
      y: selectedTools,
      type: 'heatmap',
      colorscale: 'Viridis',
      showscale: true,
      colorbar: {
        title: 'Duration (s)',
        titleside: 'right'
      }
    };
    
    // Configure layout
    const layout = {
      title: 'Average Duration by Tool and Step',
      annotations,
      margin: { l: 150, r: 50, b: 50, t: 50 },
      xaxis: {
        title: 'Step',
        side: 'bottom'
      },
      yaxis: {
        title: 'Tool',
        automargin: true
      }
    };
    
    return {
      data: [trace],
      layout
    };
  };