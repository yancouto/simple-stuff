import { test, expect } from '@playwright/test';
import path from 'path';

const GRAPH_CHECKER_URL = 'file://' + path.resolve(__dirname, '..', 'graph-checker.html');

test.describe('Graph Checker - Bug Fixes', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(GRAPH_CHECKER_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Bug 2: dragging a node moves it correctly without offset', async ({ page }) => {
    // Add a node at a specific position
    const svg = page.locator('#graphEditorSvg');
    await svg.click({ position: { x: 200, y: 150 } });
    
    // Verify node was created
    const nodes = page.locator('#graphEditorSvg g.nodes g');
    await expect(nodes).toHaveCount(1);
    
    // Get initial node position from transform attribute
    const initialTransform = await nodes.first().getAttribute('transform');
    const initialMatch = initialTransform?.match(/translate\(([\d.]+),([\d.]+)\)/);
    expect(initialMatch).toBeTruthy();
    const initialX = parseFloat(initialMatch![1]);
    const initialY = parseFloat(initialMatch![2]);
    
    console.log(`Initial position: (${initialX}, ${initialY})`);
    
    // Drag the node by a specific delta (50px right, 30px down)
    const nodeCircle = nodes.first().locator('circle');
    const boundingBox = await nodeCircle.boundingBox();
    expect(boundingBox).toBeTruthy();
    
    // Drag from center of node
    const startX = boundingBox!.x + boundingBox!.width / 2;
    const startY = boundingBox!.y + boundingBox!.height / 2;
    const dragDeltaX = 50;
    const dragDeltaY = 30;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragDeltaX, startY + dragDeltaY, { steps: 10 });
    await page.mouse.up();
    
    // Get final node position
    const finalTransform = await nodes.first().getAttribute('transform');
    const finalMatch = finalTransform?.match(/translate\(([\d.]+),([\d.]+)\)/);
    expect(finalMatch).toBeTruthy();
    const finalX = parseFloat(finalMatch![1]);
    const finalY = parseFloat(finalMatch![2]);
    
    console.log(`Final position: (${finalX}, ${finalY})`);
    console.log(`Expected position: (${initialX + dragDeltaX}, ${initialY + dragDeltaY})`);
    console.log(`Actual delta: (${finalX - initialX}, ${finalY - initialY})`);
    
    // The node should move by approximately the drag delta
    // Allow 5px tolerance for coordinate system differences
    expect(Math.abs((finalX - initialX) - dragDeltaX)).toBeLessThan(5);
    expect(Math.abs((finalY - initialY) - dragDeltaY)).toBeLessThan(5);
  });

  test('Bug 3: delete tool deletes nodes when clicked', async ({ page }) => {
    // Add two nodes
    const svg = page.locator('#graphEditorSvg');
    await svg.click({ position: { x: 200, y: 150 } });
    await svg.click({ position: { x: 300, y: 200 } });
    
    // Verify 2 nodes were created
    let nodes = page.locator('#graphEditorSvg g.nodes g');
    await expect(nodes).toHaveCount(2);
    
    // Switch to delete tool
    await page.click('button[data-tool="delete"]');
    await page.waitForTimeout(500); // Wait for tool to activate
    
    // Verify delete tool is active
    const deleteBtn = page.locator('button[data-tool="delete"]');
    await expect(deleteBtn).toHaveClass(/active/);
    
    // Click on first node's circle to delete it
    const firstNodeCircle = nodes.first().locator('circle');
    await firstNodeCircle.hover();
    await firstNodeCircle.click();
    
    // Verify only 1 node remains
    nodes = page.locator('#graphEditorSvg g.nodes g');
    await expect(nodes).toHaveCount(1);
    
    // Click on remaining node to delete it
    const remainingNode = nodes.first().locator('circle');
    await remainingNode.click();
    
    // Verify all nodes are deleted
    nodes = page.locator('#graphEditorSvg g.nodes g');
    await expect(nodes).toHaveCount(0);
  });

  test('Bug 3: delete tool deletes edges when clicked', async ({ page }) => {
    // Add two nodes
    const svg = page.locator('#graphEditorSvg');
    await svg.click({ position: { x: 200, y: 150 } });
    await svg.click({ position: { x: 300, y: 200 } });
    
    // Switch to edge tool
    await page.click('button[data-tool="addEdge"]');
    
    // Click both nodes to create an edge
    const nodes = page.locator('#graphEditorSvg g.nodes g circle');
    await nodes.nth(0).click();
    await nodes.nth(1).click();
    
    // Verify edge was created
    let edges = page.locator('#graphEditorSvg g.edges line');
    await expect(edges).toHaveCount(1);
    
    // Switch to delete tool
    await page.click('button[data-tool="delete"]');
    
    // Click on the edge to delete it
    const edge = edges.first();
    await edge.click();
    
    // Verify edge is deleted
    edges = page.locator('#graphEditorSvg g.edges line');
    await expect(edges).toHaveCount(0);
  });

  test('export button appears for interval graph', async ({ page }) => {
    const svg = page.locator('#graphEditorSvg');
    
    // Create a path graph A-B-C (always an interval graph)
    await svg.click({ position: { x: 100, y: 200 } }); // Node A
    await svg.click({ position: { x: 250, y: 200 } }); // Node B
    await svg.click({ position: { x: 400, y: 200 } }); // Node C
    
    // Switch to edge mode
    await page.click('button[data-tool="addEdge"]');
    
    // Add edges A-B and B-C
    const circles = page.locator('#graphEditorSvg g.nodes g circle');
    await circles.nth(0).click(); // A
    await circles.nth(1).click(); // B
    await circles.nth(1).click(); // B
    await circles.nth(2).click(); // C
    
    // Wait for validation
    await page.waitForTimeout(500);
    
    // Export button should be visible
    const exportBtn = page.locator('#exportIntervalsBtn');
    await expect(exportBtn).toBeVisible();
  });

  test('export button does not appear for non-interval graph', async ({ page }) => {
    const svg = page.locator('#graphEditorSvg');
    
    // Create a cycle of 4 nodes (not an interval graph - not chordal)
    await svg.click({ position: { x: 200, y: 150 } }); // Node A
    await svg.click({ position: { x: 350, y: 150 } }); // Node B
    await svg.click({ position: { x: 350, y: 300 } }); // Node C
    await svg.click({ position: { x: 200, y: 300 } }); // Node D
    
    // Switch to edge mode
    await page.click('button[data-tool="addEdge"]');
    
    // Add edges forming a 4-cycle: A-B, B-C, C-D, D-A
    const circles = page.locator('#graphEditorSvg g.nodes g circle');
    await circles.nth(0).click(); // A
    await circles.nth(1).click(); // B
    await circles.nth(1).click(); // B
    await circles.nth(2).click(); // C
    await circles.nth(2).click(); // C
    await circles.nth(3).click(); // D
    await circles.nth(3).click(); // D
    await circles.nth(0).click(); // A
    
    // Wait for validation
    await page.waitForTimeout(500);
    
    // Export button should not exist or be hidden
    const exportBtn = page.locator('#exportIntervalsBtn');
    await expect(exportBtn).not.toBeVisible();
  });

  test('exported intervals can be imported into index.html', async ({ page }) => {
    // Step 1: Create and export from graph-checker
    const svg = page.locator('#graphEditorSvg');
    
    // Create a path graph A-B-C
    await svg.click({ position: { x: 100, y: 200 } });
    await svg.click({ position: { x: 250, y: 200 } });
    await svg.click({ position: { x: 400, y: 200 } });
    
    // Add edges
    await page.click('button[data-tool="addEdge"]');
    const circles = page.locator('#graphEditorSvg g.nodes g circle');
    await circles.nth(0).click();
    await circles.nth(1).click();
    await circles.nth(1).click();
    await circles.nth(2).click();
    
    await page.waitForTimeout(500);
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportIntervalsBtn');
    const download = await downloadPromise;
    
    // Save the file
    const filePath = path.resolve(__dirname, '..', 'test-results', 'exported-intervals.json');
    await download.saveAs(filePath);
    
    // Read and verify the exported JSON
    const fs = require('fs');
    const exportedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    expect(exportedData.version).toBe('1.0');
    expect(exportedData.intervals).toHaveLength(3);
    expect(exportedData.intervals[0].name).toBe('A');
    expect(exportedData.intervals[1].name).toBe('B');
    expect(exportedData.intervals[2].name).toBe('C');
    expect(exportedData.nextId).toBe(4);
    expect(exportedData.colorIndex).toBe(3);
    
    // Verify each interval has required fields
    for (const interval of exportedData.intervals) {
      expect(interval).toHaveProperty('id');
      expect(interval).toHaveProperty('name');
      expect(interval).toHaveProperty('start');
      expect(interval).toHaveProperty('end');
      expect(interval).toHaveProperty('color');
      expect(interval.start).toBeGreaterThanOrEqual(0);
      expect(interval.end).toBeGreaterThanOrEqual(interval.start);
      expect(interval.end).toBeLessThanOrEqual(100);
    }
  });

  test('lastValidIntervals property stores intervals for valid graphs', async ({ page }) => {
    const svg = page.locator('#graphEditorSvg');
    
    // Create a simple triangle (interval graph)
    await svg.click({ position: { x: 200, y: 150 } }); // Node A
    await svg.click({ position: { x: 350, y: 150 } }); // Node B
    await svg.click({ position: { x: 275, y: 280 } }); // Node C
    
    // Switch to edge mode
    await page.click('button[data-tool="addEdge"]');
    
    // Connect all three nodes to form a triangle
    const circles = page.locator('#graphEditorSvg g.nodes g circle');
    await circles.nth(0).click(); // A
    await circles.nth(1).click(); // B
    await circles.nth(1).click(); // B
    await circles.nth(2).click(); // C
    await circles.nth(2).click(); // C
    await circles.nth(0).click(); // A
    
    // Wait for validation
    await page.waitForTimeout(500);
    
    // Check that lastValidIntervals is stored
    const intervals = await page.evaluate(() => {
      return (window as any).app.lastValidIntervals;
    });
    
    expect(intervals).not.toBeNull();
    expect(Array.isArray(intervals)).toBe(true);
    expect(intervals.length).toBe(3); // Should have 3 intervals for 3 nodes
    
    // Each interval should have start and end properties
    intervals.forEach((interval: any) => {
      expect(interval).toHaveProperty('start');
      expect(interval).toHaveProperty('end');
      expect(typeof interval.start).toBe('number');
      expect(typeof interval.end).toBe('number');
    });
  });

  test('lastValidIntervals property is null for non-interval graphs', async ({ page }) => {
    const svg = page.locator('#graphEditorSvg');
    
    // Create a cycle of 4 nodes (not an interval graph)
    await svg.click({ position: { x: 200, y: 150 } }); // Node A
    await svg.click({ position: { x: 350, y: 150 } }); // Node B
    await svg.click({ position: { x: 350, y: 300 } }); // Node C
    await svg.click({ position: { x: 200, y: 300 } }); // Node D
    
    // Switch to edge mode
    await page.click('button[data-tool="addEdge"]');
    
    // Add edges forming a 4-cycle: A-B, B-C, C-D, D-A (not chordal)
    const circles = page.locator('#graphEditorSvg g.nodes g circle');
    await circles.nth(0).click(); // A
    await circles.nth(1).click(); // B
    await circles.nth(1).click(); // B
    await circles.nth(2).click(); // C
    await circles.nth(2).click(); // C
    await circles.nth(3).click(); // D
    await circles.nth(3).click(); // D
    await circles.nth(0).click(); // A
    
    // Wait for validation
    await page.waitForTimeout(500);
    
    // Check that lastValidIntervals is null
    const intervals = await page.evaluate(() => {
      return (window as any).app.lastValidIntervals;
    });
    
    expect(intervals).toBeNull();
  });

  test('lastValidIntervals property is null for empty graph', async ({ page }) => {
    // Don't create any nodes - start with empty graph
    
    // Wait a bit for initial validation
    await page.waitForTimeout(500);
    
    // Check that lastValidIntervals is null for empty graph
    const intervals = await page.evaluate(() => {
      return (window as any).app.lastValidIntervals;
    });
    
    expect(intervals).toBeNull();
  });
});
