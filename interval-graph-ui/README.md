# Interval Graph Visualizer

An interactive web application for drawing and visualizing interval graphs.

## What is an Interval Graph?

An interval graph is a graph where:
- Each node represents an interval on a number line
- Two nodes are connected by an edge if and only if their intervals intersect

## Features

- **Interactive Timeline**: Visual representation of intervals on a number line (0-100)
- **Dynamic Graph Visualization**: Force-directed layout using D3.js for optimal node placement
- **Draggable Nodes**: Drag nodes in the graph to manually adjust the layout
- **Node Fixing**: Nodes become fixed after dragging (shown with black circle), click to unfix
- **5 Workspaces**: Switch between 5 independent workspaces to work on multiple examples
- **Smart Layout**: Non-intersecting intervals share the same row on the timeline
- **Hover Tooltips**: Hover over intervals to see details and interaction hints
- **Keyboard Shortcuts**: ESC to close modal, Enter to save, quick navigation
- **Inline Validation**: Real-time error messages without disruptive alerts
- **Auto-Select Text**: Quick editing with automatic text selection
- **Duplicate Intervals**: One-click interval duplication with offset
- **Export/Import**: Save and load interval sets as JSON files
- **Example Datasets**: Quick-load example graphs to explore functionality
- **Live Statistics**: Coverage percentage and average interval length
- **Persistence**: All workspaces saved to localStorage and restored on reload
- **Zoom & Pan**: Use mouse wheel to zoom, drag background to pan the graph
- **Responsive Design**: Works on different screen sizes

## How to Use

1. **Open `index.html`** in a web browser

2. **Quick Start**:
   - Click "Load Example 1" or "Load Example 2" to see sample graphs
   - Or drag on the timeline to create your first interval

3. **Create Intervals**:
   - **Drag on timeline axis** → Instantly creates an interval
   - **"+ Add Interval" button** → Manual entry with form
   - Auto-generates unique names (A, B, C, etc.)

4. **Edit Intervals**:
   - **Click interval** on timeline → Opens edit modal
   - **Hover** over interval → Shows tooltip with details
   - Modal includes Duplicate and Delete buttons
   - Press **Enter** to save, **ESC** to cancel

5. **Delete Intervals**:
   - **Right-click** interval on timeline (with confirmation)
   - **Delete button** in edit modal
   - 🗑️ icon in interval list

6. **Arrange Graph**:
   - **Drag nodes** to manually position them (they become fixed with black circle)
   - **Click fixed node** to unfix it and let it move freely
   - **Reset Layout** button to restart force simulation
   - **Zoom**: Mouse wheel or pinch gesture
   - **Pan**: Drag empty space in graph

7. **Switch Workspaces**:
   - Use buttons **1-5** to switch between independent workspaces
   - Each workspace maintains its own intervals separately
   - Perfect for comparing different examples

8. **Save/Load**:
   - **Export** → Download intervals as JSON file
   - **Import** → Load previously saved interval sets
   - Automatic localStorage backup on every change

8. **View Statistics**:
   - Total coverage percentage
   - Average interval length
   - Node and edge counts

## Example

Try creating these intervals:
- **A**: [10, 40]
- **B**: [30, 60]
- **C**: [50, 80]
- **D**: [70, 90]

You'll see that:
- A connects to B (they overlap in [30, 40])
- B connects to C (they overlap in [50, 60])
- C connects to D (they overlap in [70, 80])
- A and D don't connect (no overlap)

## Technical Details

- Pure vanilla JavaScript with D3.js for graph visualization
- HTML5 Canvas for timeline rendering
- D3.js force-directed graph layout with draggable nodes
- localStorage for data persistence
- Responsive CSS Grid layout
- Minimal dependencies (only D3.js)

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `script.js` - Application logic and visualization
- `README.md` - This file
