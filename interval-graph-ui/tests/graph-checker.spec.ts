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
});
