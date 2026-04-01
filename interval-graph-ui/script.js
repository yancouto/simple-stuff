class IntervalGraphVisualizer {
    constructor() {
        this.currentWorkspace = 1;
        this.workspaces = {};
        
        this.intervals = [];
        this.nextId = 1;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
            '#E63946', '#A8DADC', '#457B9D', '#F77F00', '#06A77D'
        ];
        this.colorIndex = 0;
        this.editingId = null;
        
        // Mouse drag state (create new interval)
        this.isDragging = false;
        this.dragStartX = null;
        this.dragCurrentX = null;
        this.previewColor = this.colors[0];

        // Interval interaction state (move / resize)
        this.interactionMode = null; // null | 'create' | 'move' | 'resize-left' | 'resize-right'
        this.activeInterval = null;
        this.dragOffsetValue = 0;
        this.hasMoved = false;
        this.mouseDownPos = null;
        this.hoveredInteraction = null; // {interval, type: 'left'|'right'|'body'}

        // Timeline layout
        this.intervalLevels = new Map();
        
        // Hover state
        this.hoveredInterval = null;
        this.tooltip = document.getElementById('tooltip');
        
        // D3 graph state
        this.simulation = null;
        this.svg = null;
        
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        
        this.loadFromStorage();
        this.initCanvases();
        this.setupEventListeners();
        this.initWorkspaceButtons();
        this.updateIntervalList();
        this.draw();
    }
    
    initWorkspaceButtons() {
        // Set the correct active state for workspace buttons
        document.querySelectorAll('.workspace-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.workspace) === this.currentWorkspace);
        });
    }
    
    initCanvases() {
        const setCanvasSize = (canvas, width, height) => {
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
        };
        
        const timelineWidth = this.timelineCanvas.parentElement.clientWidth - 40;
        setCanvasSize(this.timelineCanvas, timelineWidth, 250);
        
        // Initialize D3 SVG
        this.svg = d3.select('#graphSvg');
    }
    
    setupEventListeners() {
        document.getElementById('addIntervalBtn').addEventListener('click', () => this.openModal());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('resetLayoutBtn').addEventListener('click', () => this.resetGraphLayout());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportIntervals());
        document.getElementById('importBtn').addEventListener('click', () => this.importIntervals());
        document.getElementById('loadExample1').addEventListener('click', () => this.loadExample1());
        document.getElementById('loadExample2').addEventListener('click', () => this.loadExample2());
        
        // Workspace selector
        document.querySelectorAll('.workspace-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const workspace = parseInt(e.target.dataset.workspace);
                this.switchWorkspace(workspace);
            });
        });
        
        const modal = document.getElementById('intervalModal');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancelBtn');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        
        const deleteModalBtn = document.getElementById('deleteModalBtn');
        deleteModalBtn.addEventListener('click', () => {
            if (this.editingId) {
                this.deleteInterval(this.editingId);
                this.closeModal();
            }
        });
        
        const duplicateBtn = document.getElementById('duplicateBtn');
        duplicateBtn.addEventListener('click', () => {
            if (this.editingId) {
                const interval = this.intervals.find(i => i.id === this.editingId);
                this.duplicateInterval(interval);
                this.closeModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
        
        document.getElementById('intervalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveInterval();
        });
        
        // Clear error messages on input
        ['intervalName', 'intervalStart', 'intervalEnd'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.clearError(id);
            });
        });
        
        // Mouse events for dragging on timeline
        this.timelineCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.timelineCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.timelineCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.timelineCanvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.timelineCanvas.addEventListener('contextmenu', (e) => this.onContextMenu(e), { passive: false });
        
        // Touch events for mobile support
        this.timelineCanvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.timelineCanvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.timelineCanvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Fullscreen buttons
        this.setupFullscreen();

        window.addEventListener('resize', () => {
            this.initCanvases();
            this.draw();
        });
    }
    
    saveToStorage() {
        // Save current workspace
        this.workspaces[this.currentWorkspace] = {
            intervals: this.intervals,
            nextId: this.nextId,
            colorIndex: this.colorIndex
        };
        
        // Save all workspaces
        localStorage.setItem('intervalGraphWorkspaces', JSON.stringify(this.workspaces));
        localStorage.setItem('intervalGraphCurrentWorkspace', this.currentWorkspace.toString());
    }
    
    loadFromStorage() {
        try {
            const workspacesData = localStorage.getItem('intervalGraphWorkspaces');
            const currentWorkspace = localStorage.getItem('intervalGraphCurrentWorkspace');
            
            if (workspacesData) {
                this.workspaces = JSON.parse(workspacesData);
            }
            
            if (currentWorkspace) {
                this.currentWorkspace = parseInt(currentWorkspace);
            }
            
            // Load current workspace data
            this.loadWorkspace(this.currentWorkspace);
        } catch (e) {
            console.error('Failed to load stored data:', e);
        }
    }
    
    loadWorkspace(workspaceNum) {
        const workspace = this.workspaces[workspaceNum];
        if (workspace) {
            this.intervals = workspace.intervals || [];
            this.nextId = workspace.nextId || 1;
            this.colorIndex = workspace.colorIndex || 0;
        } else {
            // Initialize empty workspace
            this.intervals = [];
            this.nextId = 1;
            this.colorIndex = 0;
        }
    }
    
    switchWorkspace(workspaceNum) {
        // Save current workspace
        this.workspaces[this.currentWorkspace] = {
            intervals: this.intervals,
            nextId: this.nextId,
            colorIndex: this.colorIndex
        };
        
        // Switch to new workspace
        this.currentWorkspace = workspaceNum;
        this.loadWorkspace(workspaceNum);
        
        // Update UI
        document.querySelectorAll('.workspace-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.workspace) === workspaceNum);
        });
        
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    openModal(interval = null) {
        const modal = document.getElementById('intervalModal');
        const modalTitle = document.getElementById('modalTitle');
        const nameInput = document.getElementById('intervalName');
        const startInput = document.getElementById('intervalStart');
        const endInput = document.getElementById('intervalEnd');
        const deleteBtn = document.getElementById('deleteModalBtn');
        const duplicateBtn = document.getElementById('duplicateBtn');
        
        // Clear previous errors
        this.clearError('intervalName');
        this.clearError('intervalStart');
        this.clearError('intervalEnd');
        
        if (interval) {
            this.editingId = interval.id;
            modalTitle.textContent = 'Edit Interval';
            nameInput.value = interval.name;
            startInput.value = interval.start;
            endInput.value = interval.end;
            deleteBtn.style.display = 'block';
            duplicateBtn.style.display = 'block';
        } else {
            this.editingId = null;
            modalTitle.textContent = 'Add Interval';
            nameInput.value = String.fromCharCode(65 + (this.intervals.length % 26));
            startInput.value = 10;
            endInput.value = 30;
            deleteBtn.style.display = 'none';
            duplicateBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
        nameInput.focus();
        nameInput.select();
    }
    
    closeModal() {
        document.getElementById('intervalModal').style.display = 'none';
        this.editingId = null;
    }
    
    saveInterval() {
        const name = document.getElementById('intervalName').value.trim();
        const start = parseFloat(document.getElementById('intervalStart').value);
        const end = parseFloat(document.getElementById('intervalEnd').value);
        
        // Validate
        let hasError = false;
        
        if (!name) {
            this.showError('intervalName', 'Name is required');
            hasError = true;
        }
        
        if (isNaN(start) || start < 0 || start > 100) {
            this.showError('intervalStart', 'Start must be between 0 and 100');
            hasError = true;
        }
        
        if (isNaN(end) || end < 0 || end > 100) {
            this.showError('intervalEnd', 'End must be between 0 and 100');
            hasError = true;
        }
        
        if (!hasError && start >= end) {
            this.showError('intervalEnd', 'End must be greater than Start');
            hasError = true;
        }
        
        if (hasError) return;
        
        if (this.editingId) {
            const interval = this.intervals.find(i => i.id === this.editingId);
            interval.name = name;
            interval.start = start;
            interval.end = end;
        } else {
            this.intervals.push({
                id: this.nextId++,
                name: name,
                start: start,
                end: end,
                color: this.colors[this.colorIndex % this.colors.length]
            });
            this.colorIndex++;
        }
        
        this.closeModal();
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    showError(fieldId, message) {
        const errorId = fieldId === 'intervalName' ? 'nameError' : 
                        fieldId === 'intervalStart' ? 'startError' : 'endError';
        const errorElement = document.getElementById(errorId);
        errorElement.textContent = message;
        document.getElementById(fieldId).style.borderColor = '#dc3545';
    }
    
    clearError(fieldId) {
        const errorId = fieldId === 'intervalName' ? 'nameError' : 
                        fieldId === 'intervalStart' ? 'startError' : 'endError';
        const errorElement = document.getElementById(errorId);
        errorElement.textContent = '';
        document.getElementById(fieldId).style.borderColor = '#e0e0e0';
    }
    
    createIntervalFromDrag(start, end, name = null) {
        if (!name) {
            name = String.fromCharCode(65 + (this.intervals.length % 26));
            // Add number suffix if name already exists
            let suffix = 1;
            let finalName = name;
            while (this.intervals.some(i => i.name === finalName)) {
                finalName = name + suffix++;
            }
            name = finalName;
        }
        
        this.intervals.push({
            id: this.nextId++,
            name: name,
            start: start,
            end: end,
            color: this.colors[this.colorIndex % this.colors.length]
        });
        this.colorIndex++;
        
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    deleteInterval(id) {
        this.intervals = this.intervals.filter(i => i.id !== id);
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    clearAll() {
        if (this.intervals.length > 0 && confirm('Clear all intervals?')) {
            this.intervals = [];
            this.saveToStorage();
            this.updateIntervalList();
            this.draw();
        }
    }
    
    updateIntervalList() {
        const listContainer = document.getElementById('intervalList');
        listContainer.innerHTML = '';
        
        if (this.intervals.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>🎨 <strong>Get Started!</strong></p>
                    <p>Click and drag on the timeline above to create your first interval.</p>
                    <div class="example-buttons">
                        <button id="loadExample1" class="btn btn-small btn-secondary">Load Example 1</button>
                        <button id="loadExample2" class="btn btn-small btn-secondary">Load Example 2</button>
                    </div>
                </div>
            `;
            document.getElementById('loadExample1').addEventListener('click', () => this.loadExample1());
            document.getElementById('loadExample2').addEventListener('click', () => this.loadExample2());
            document.getElementById('intervalStats').textContent = '';
        } else {
            this.intervals.forEach(interval => {
                const item = document.createElement('div');
                item.className = 'interval-item';
                item.style.borderLeftColor = interval.color;
                
                item.innerHTML = `
                    <div class="interval-item-header">
                        <span class="interval-item-name" style="color: ${interval.color}">${interval.name}</span>
                        <div class="interval-item-actions">
                            <button class="icon-btn edit-btn" data-id="${interval.id}" title="Edit">✏️</button>
                            <button class="icon-btn delete-btn" data-id="${interval.id}" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div class="interval-item-range">[${interval.start.toFixed(1)}, ${interval.end.toFixed(1)}]</div>
                `;
                
                item.querySelector('.edit-btn').addEventListener('click', () => this.openModal(interval));
                item.querySelector('.delete-btn').addEventListener('click', () => this.deleteInterval(interval.id));
                
                listContainer.appendChild(item);
            });
            
            // Update stats
            const totalCoverage = this.calculateCoverage();
            const avgLength = this.intervals.reduce((sum, i) => sum + (i.end - i.start), 0) / this.intervals.length;
            document.getElementById('intervalStats').textContent = 
                `Coverage: ${totalCoverage.toFixed(1)}% • Avg Length: ${avgLength.toFixed(1)}`;
        }
        
        document.getElementById('nodeCount').textContent = `Nodes: ${this.intervals.length}`;
    }
    
    calculateCoverage() {
        if (this.intervals.length === 0) return 0;
        
        // Merge overlapping intervals to calculate total coverage
        const sorted = [...this.intervals].sort((a, b) => a.start - b.start);
        let covered = 0;
        let currentStart = sorted[0].start;
        let currentEnd = sorted[0].end;
        
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].start <= currentEnd) {
                currentEnd = Math.max(currentEnd, sorted[i].end);
            } else {
                covered += currentEnd - currentStart;
                currentStart = sorted[i].start;
                currentEnd = sorted[i].end;
            }
        }
        covered += currentEnd - currentStart;
        
        return covered;
    }
    
    duplicateInterval(interval) {
        const offset = 5;
        const newInterval = {
            id: this.nextId++,
            name: interval.name + "'",
            start: Math.min(100, interval.start + offset),
            end: Math.min(100, interval.end + offset),
            color: this.colors[this.colorIndex % this.colors.length]
        };
        this.colorIndex++;
        this.intervals.push(newInterval);
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    intervalsIntersect(a, b) {
        return a.start < b.end && b.start < a.end;
    }
    
    getMousePosition(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const scaleX = this.timelineCanvas.width / rect.width;
        const scaleY = this.timelineCanvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    getIntervalAtPosition(x, y) {
        const hit = this.getIntervalInteraction(x, y);
        return hit ? hit.interval : null;
    }

    // Returns {interval, type: 'left'|'right'|'body'} or null.
    // 'left'/'right' = within EDGE_THRESHOLD px of an endpoint; 'body' = interior.
    getIntervalInteraction(x, y) {
        const EDGE_THRESHOLD = 10;
        const padding = 60;
        const lineStart = padding;
        const lineEnd = this.timelineCanvas.width - padding;
        const lineLength = lineEnd - lineStart;
        const lineY = 80;
        const intervalHeight = 25;
        const spacing = 35;

        for (const [intervalId, level] of this.intervalLevels.entries()) {
            const interval = this.intervals.find(i => i.id === intervalId);
            if (!interval) continue;

            const yPos = lineY + 40 + (level * spacing);
            const xStart = lineStart + (lineLength * interval.start / 100);
            const xEnd = lineStart + (lineLength * interval.end / 100);

            if (y < yPos - intervalHeight / 2 || y > yPos + intervalHeight / 2) continue;
            if (x < xStart - EDGE_THRESHOLD || x > xEnd + EDGE_THRESHOLD) continue;

            if (Math.abs(x - xStart) <= EDGE_THRESHOLD) return { interval, type: 'left' };
            if (Math.abs(x - xEnd) <= EDGE_THRESHOLD) return { interval, type: 'right' };
            if (x >= xStart && x <= xEnd) return { interval, type: 'body' };
        }
        return null;
    }
    
    xToValue(x) {
        const padding = 60;
        const lineStart = padding;
        const lineEnd = this.timelineCanvas.width - padding;
        const lineLength = lineEnd - lineStart;
        
        const value = ((x - lineStart) / lineLength) * 100;
        return Math.max(0, Math.min(100, value));
    }
    
    onMouseDown(e) {
        // Ignore right clicks for dragging
        if (e.button === 2) return;

        const pos = this.getMousePosition(e);
        this.mouseDownPos = pos;
        this.hasMoved = false;

        // Check if clicking on an existing interval
        const interaction = this.getIntervalInteraction(pos.x, pos.y);
        if (interaction) {
            if (interaction.type === 'left') {
                this.interactionMode = 'resize-left';
            } else if (interaction.type === 'right') {
                this.interactionMode = 'resize-right';
            } else {
                this.interactionMode = 'move';
                this.dragOffsetValue = this.xToValue(pos.x) - interaction.interval.start;
            }
            this.activeInterval = interaction.interval;
            return;
        }

        const padding = 60;
        const lineY = 80;

        // Check if clicking in the timeline axis area to create new interval
        if (pos.x >= padding && pos.x <= this.timelineCanvas.width - padding &&
            pos.y >= lineY - 20 && pos.y <= lineY + 20) {
            this.interactionMode = 'create';
            this.isDragging = true;
            this.dragStartX = pos.x;
            this.dragCurrentX = pos.x;
            this.previewColor = this.colors[this.colorIndex % this.colors.length];
            this.timelineCanvas.style.cursor = 'crosshair';
        }
    }

    onMouseMove(e) {
        const pos = this.getMousePosition(e);
        const MOVE_THRESHOLD = 3;

        if (this.interactionMode === 'create' && this.isDragging) {
            this.dragCurrentX = pos.x;
            this.hasMoved = true;
            this.draw();
            this.drawDragPreview();
            return;
        }

        if (this.interactionMode === 'move' && this.activeInterval) {
            if (!this.hasMoved && Math.abs(pos.x - this.mouseDownPos.x) < MOVE_THRESHOLD) return;
            this.hasMoved = true;
            const value = this.xToValue(pos.x);
            const width = this.activeInterval.end - this.activeInterval.start;
            let newStart = value - this.dragOffsetValue;
            if (newStart < 0) newStart = 0;
            if (newStart + width > 100) newStart = 100 - width;
            this.activeInterval.start = Math.round(newStart * 10) / 10;
            this.activeInterval.end = Math.round((newStart + width) * 10) / 10;
            this.timelineCanvas.style.cursor = 'grabbing';
            this.draw();
            return;
        }

        if (this.interactionMode === 'resize-left' && this.activeInterval) {
            if (!this.hasMoved && Math.abs(pos.x - this.mouseDownPos.x) < MOVE_THRESHOLD) return;
            this.hasMoved = true;
            const value = this.xToValue(pos.x);
            this.activeInterval.start = Math.round(Math.max(0, Math.min(value, this.activeInterval.end - 1)) * 10) / 10;
            this.timelineCanvas.style.cursor = 'ew-resize';
            this.draw();
            return;
        }

        if (this.interactionMode === 'resize-right' && this.activeInterval) {
            if (!this.hasMoved && Math.abs(pos.x - this.mouseDownPos.x) < MOVE_THRESHOLD) return;
            this.hasMoved = true;
            const value = this.xToValue(pos.x);
            this.activeInterval.end = Math.round(Math.min(100, Math.max(value, this.activeInterval.start + 1)) * 10) / 10;
            this.timelineCanvas.style.cursor = 'ew-resize';
            this.draw();
            return;
        }

        // No active interaction — update cursor and tooltip based on hover
        const interaction = this.getIntervalInteraction(pos.x, pos.y);
        if (interaction) {
            if (interaction.type === 'left' || interaction.type === 'right') {
                this.timelineCanvas.style.cursor = 'ew-resize';
                this.showTooltip(e.clientX, e.clientY, interaction.interval, 'Drag to resize');
            } else {
                this.timelineCanvas.style.cursor = 'grab';
                this.showTooltip(e.clientX, e.clientY, interaction.interval, 'Drag to move • Click to edit');
            }
            const prev = this.hoveredInteraction;
            if (!prev || prev.interval.id !== interaction.interval.id || prev.type !== interaction.type) {
                this.hoveredInteraction = interaction;
                this.draw();
            }
        } else {
            const hadHover = this.hoveredInteraction !== null;
            this.hoveredInteraction = null;
            this.hideTooltip();
            const padding = 60;
            const lineY = 80;
            if (pos.x >= padding && pos.x <= this.timelineCanvas.width - padding &&
                pos.y >= lineY - 20 && pos.y <= lineY + 20) {
                this.timelineCanvas.style.cursor = 'crosshair';
            } else {
                this.timelineCanvas.style.cursor = 'default';
            }
            if (hadHover) this.draw();
        }
    }
    
    showTooltip(x, y, interval, hint = null) {
        const base = `${interval.name}: [${interval.start.toFixed(1)}, ${interval.end.toFixed(1)}]`;
        const hintText = hint ? ` • ${hint}` : ' • Drag to move • Click to edit • Right-click to delete';
        this.tooltip.textContent = base + hintText;
        this.tooltip.style.left = (x + 10) + 'px';
        this.tooltip.style.top = (y - 30) + 'px';
        this.tooltip.classList.add('visible');
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    onMouseUp(e) {
        if (this.interactionMode === 'create') {
            this.interactionMode = null;
            this.isDragging = false;
            this.timelineCanvas.style.cursor = 'default';

            const startValue = this.xToValue(this.dragStartX);
            const endValue = this.xToValue(this.dragCurrentX);
            const minValue = Math.min(startValue, endValue);
            const maxValue = Math.max(startValue, endValue);

            if (maxValue - minValue >= 1) {
                this.createIntervalFromDrag(
                    Math.round(minValue * 10) / 10,
                    Math.round(maxValue * 10) / 10
                );
            }

            this.dragStartX = null;
            this.dragCurrentX = null;
            this.draw();
            return;
        }

        if (this.interactionMode && this.activeInterval) {
            if (this.hasMoved) {
                this.saveToStorage();
                this.updateIntervalList();
            } else {
                // Click without drag → open edit modal
                this.openModal(this.activeInterval);
            }
            this.interactionMode = null;
            this.activeInterval = null;
            this.hasMoved = false;
            this.timelineCanvas.style.cursor = 'default';
            this.draw();
            return;
        }

        this.interactionMode = null;
    }
    
    onContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getMousePosition(e);
        const clickedInterval = this.getIntervalAtPosition(pos.x, pos.y);
        
        if (clickedInterval) {
            if (confirm(`Delete interval "${clickedInterval.name}"?`)) {
                this.deleteInterval(clickedInterval.id);
            }
        }
        
        return false;
    }
    
    onMouseLeave(e) {
        if (this.interactionMode === 'create' && this.isDragging) {
            this.interactionMode = null;
            this.isDragging = false;
            this.timelineCanvas.style.cursor = 'default';
            this.dragStartX = null;
            this.dragCurrentX = null;
            this.draw();
        } else if (this.interactionMode && this.activeInterval && this.hasMoved) {
            // Save drag/resize in progress
            this.saveToStorage();
            this.updateIntervalList();
            this.interactionMode = null;
            this.activeInterval = null;
            this.hasMoved = false;
        } else {
            this.interactionMode = null;
            this.activeInterval = null;
        }
        this.hoveredInteraction = null;
        this.hideTooltip();
    }
    
    // Touch events for mobile
    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
    
    onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        this.onMouseUp({});
    }
    
    drawDragPreview() {
        if (!this.isDragging || !this.dragStartX || !this.dragCurrentX) return;
        
        const ctx = this.timelineCtx;
        const padding = 60;
        const lineY = 80;
        const lineStart = padding;
        const lineEnd = this.timelineCanvas.width - padding;
        
        const xStart = Math.max(lineStart, Math.min(lineEnd, Math.min(this.dragStartX, this.dragCurrentX)));
        const xEnd = Math.max(lineStart, Math.min(lineEnd, Math.max(this.dragStartX, this.dragCurrentX)));
        
        // Draw semi-transparent preview
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = this.previewColor;
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(xStart, lineY);
        ctx.lineTo(xEnd, lineY);
        ctx.stroke();
        
        // Draw values
        ctx.globalAlpha = 1;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        
        const startValue = this.xToValue(xStart);
        const endValue = this.xToValue(xEnd);
        
        ctx.fillText(startValue.toFixed(1), xStart, lineY - 20);
        ctx.fillText(endValue.toFixed(1), xEnd, lineY - 20);
        
        ctx.restore();
    }
    
    exportIntervals() {
        const data = {
            intervals: this.intervals,
            nextId: this.nextId,
            colorIndex: this.colorIndex,
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intervals_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    importIntervals() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.intervals && Array.isArray(data.intervals)) {
                        if (this.intervals.length > 0) {
                            if (!confirm('This will replace your current intervals. Continue?')) {
                                return;
                            }
                        }
                        this.intervals = data.intervals;
                        this.nextId = data.nextId || this.intervals.length + 1;
                        this.colorIndex = data.colorIndex || this.intervals.length;
                        this.saveToStorage();
                        this.updateIntervalList();
                        this.draw();
                    } else {
                        alert('Invalid file format');
                    }
                } catch (err) {
                    alert('Error reading file: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    loadExample1() {
        this.intervals = [
            { id: 1, name: 'A', start: 10, end: 40, color: '#FF6B6B' },
            { id: 2, name: 'B', start: 30, end: 60, color: '#4ECDC4' },
            { id: 3, name: 'C', start: 50, end: 80, color: '#45B7D1' },
            { id: 4, name: 'D', start: 70, end: 90, color: '#FFA07A' }
        ];
        this.nextId = 5;
        this.colorIndex = 4;
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    loadExample2() {
        this.intervals = [
            { id: 1, name: 'A', start: 5, end: 25, color: '#FF6B6B' },
            { id: 2, name: 'B', start: 10, end: 30, color: '#4ECDC4' },
            { id: 3, name: 'C', start: 20, end: 50, color: '#45B7D1' },
            { id: 4, name: 'D', start: 40, end: 70, color: '#FFA07A' },
            { id: 5, name: 'E', start: 60, end: 85, color: '#98D8C8' },
            { id: 6, name: 'F', start: 75, end: 95, color: '#F7DC6F' }
        ];
        this.nextId = 7;
        this.colorIndex = 6;
        this.saveToStorage();
        this.updateIntervalList();
        this.draw();
    }
    
    calculateIntervalLevels() {
        this.intervalLevels.clear();
        
        // Sort intervals by start position
        const sorted = [...this.intervals].sort((a, b) => a.start - b.start);
        
        // Assign levels to minimize vertical space
        const levelEndTimes = [];
        
        sorted.forEach(interval => {
            // Find the first level where this interval can fit
            let level = 0;
            while (level < levelEndTimes.length && levelEndTimes[level] > interval.start) {
                level++;
            }
            
            // Assign this interval to the level
            this.intervalLevels.set(interval.id, level);
            
            // Update the end time for this level
            if (level >= levelEndTimes.length) {
                levelEndTimes.push(interval.end);
            } else {
                levelEndTimes[level] = interval.end;
            }
        });
        
        return Math.max(1, levelEndTimes.length);
    }
    
    setupFullscreen() {
        const toggle = (sectionId, btnId, afterToggle) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const section = document.getElementById(sectionId);
            btn.addEventListener('click', () => {
                const isFs = section.classList.toggle('section-fullscreen');
                btn.textContent = isFs ? '✕' : '⛶';
                btn.title = isFs ? 'Exit fullscreen (Esc)' : 'Fullscreen';
                setTimeout(afterToggle, 50);
            });
        };

        toggle('timelineSection', 'timelineFullscreenBtn', () => {
            this.initCanvases();
            this.draw();
        });
        toggle('graphSection', 'graphFullscreenBtn', () => {
            this.drawGraphD3();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.section-fullscreen').forEach(el => {
                    el.classList.remove('section-fullscreen');
                    const btn = el.querySelector('.fullscreen-btn');
                    if (btn) { btn.textContent = '⛶'; btn.title = 'Fullscreen'; }
                });
                setTimeout(() => { this.initCanvases(); this.draw(); }, 50);
            }
        });
    }

    draw() {
        this.drawTimeline();
        this.drawGraphD3();
    }
    
    drawTimeline() {
        const ctx = this.timelineCtx;
        const canvas = this.timelineCanvas;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const padding = 60;
        const lineY = 80;
        const lineStart = padding;
        const lineEnd = width - padding;
        const lineLength = lineEnd - lineStart;
        
        // Draw axis
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineEnd, lineY);
        ctx.stroke();
        
        // Draw tick marks
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        
        for (let i = 0; i <= 10; i++) {
            const x = lineStart + (lineLength * i / 10);
            const value = i * 10;
            
            ctx.beginPath();
            ctx.moveTo(x, lineY - 5);
            ctx.lineTo(x, lineY + 5);
            ctx.stroke();
            
            ctx.fillText(value.toString(), x, lineY + 20);
        }
        
        // Calculate interval levels for optimal layout
        const numLevels = this.calculateIntervalLevels();
        
        // Draw intervals using calculated levels
        const intervalHeight = 25;
        const spacing = 35;
        
        this.intervals.forEach((interval) => {
            const level = this.intervalLevels.get(interval.id) || 0;
            const y = lineY + 40 + (level * spacing);
            const xStart = lineStart + (lineLength * interval.start / 100);
            const xEnd = lineStart + (lineLength * interval.end / 100);

            const isActive = this.activeInterval && this.activeInterval.id === interval.id;
            const hovInt = this.hoveredInteraction && this.hoveredInteraction.interval.id === interval.id;
            
            ctx.save();

            // Slightly dim active interval while dragging
            ctx.globalAlpha = isActive ? 0.75 : 1;

            // Draw interval line
            ctx.strokeStyle = interval.color;
            ctx.lineWidth = intervalHeight;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();
            
            ctx.globalAlpha = 1;

            // Draw interval name
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(interval.name, (xStart + xEnd) / 2, y + 5);
            
            // Draw start/end values
            ctx.font = '10px Arial';
            ctx.fillStyle = '#333';
            ctx.fillText(interval.start.toFixed(1), xStart, y - 15);
            ctx.fillText(interval.end.toFixed(1), xEnd, y - 15);

            // Draw edge handles when hovering or dragging/resizing this interval
            if (hovInt || isActive) {
                const leftHot = (hovInt && this.hoveredInteraction.type === 'left') ||
                                (isActive && this.interactionMode === 'resize-left');
                const rightHot = (hovInt && this.hoveredInteraction.type === 'right') ||
                                 (isActive && this.interactionMode === 'resize-right');

                const drawHandle = (hx, hot) => {
                    ctx.beginPath();
                    ctx.arc(hx, y, 7, 0, Math.PI * 2);
                    ctx.fillStyle = hot ? '#fff' : 'rgba(255,255,255,0.85)';
                    ctx.strokeStyle = hot ? '#333' : '#777';
                    ctx.lineWidth = hot ? 2 : 1.5;
                    ctx.fill();
                    ctx.stroke();
                    // Vertical grip lines
                    ctx.strokeStyle = hot ? '#555' : '#999';
                    ctx.lineWidth = 1.5;
                    [-2.5, 0, 2.5].forEach(offset => {
                        ctx.beginPath();
                        ctx.moveTo(hx + offset, y - 3.5);
                        ctx.lineTo(hx + offset, y + 3.5);
                        ctx.stroke();
                    });
                };

                drawHandle(xStart, leftHot);
                drawHandle(xEnd, rightHot);
            }

            ctx.restore();
        });
        
        // Update canvas height if needed
        const requiredHeight = Math.max(250, lineY + 80 + (numLevels * spacing));
        if (canvas.height !== requiredHeight) {
            canvas.height = requiredHeight;
            canvas.style.height = requiredHeight + 'px';
            this.drawTimeline(); // Redraw after resize
        }
        
        // Update axis info
        document.getElementById('timelineAxis').textContent =
            'Drag axis to create • Drag edges ◀▶ to resize • Drag body to move • Click to edit • Right-click to delete';
    }
    
    resetGraphLayout() {
        this.drawGraphD3();
    }
    
    drawGraphD3() {
        if (!this.svg) return;
        
        const svg = this.svg;
        const container = document.querySelector('.graph-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Clear previous content
        svg.selectAll('*').remove();
        
        if (this.intervals.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#999')
                .attr('font-size', '16px')
                .text('Add intervals to see the graph');
            document.getElementById('edgeCount').textContent = 'Edges: 0';
            return;
        }
        
        // Build graph data with initial positions based on interval positions
        const padding = 60;
        const nodes = this.intervals.map(interval => {
            // Calculate x position based on interval midpoint
            const midpoint = (interval.start + interval.end) / 2;
            const x = padding + ((width - 2 * padding) * midpoint / 100);
            
            return {
                id: interval.id,
                name: interval.name,
                color: interval.color,
                start: interval.start,
                end: interval.end,
                x: x,
                y: height / 2
            };
        });
        
        const links = [];
        for (let i = 0; i < this.intervals.length; i++) {
            for (let j = i + 1; j < this.intervals.length; j++) {
                if (this.intervalsIntersect(this.intervals[i], this.intervals[j])) {
                    links.push({
                        source: this.intervals[i].id,
                        target: this.intervals[j].id
                    });
                }
            }
        }
        
        document.getElementById('edgeCount').textContent = `Edges: ${links.length}`;
        
        // Create force simulation
        if (this.simulation) {
            this.simulation.stop();
        }
        
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(35))
            .alphaDecay(0.05);
        
        // Create container group
        const g = svg.append('g');
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Draw edges
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', '#999')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        
        // Draw nodes
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'graph-node')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragging(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));
        
        // Add circles for nodes (smaller radius)
        node.append('circle')
            .attr('r', 25)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 3);
        
        // Add black circle for fixed nodes
        node.append('circle')
            .attr('r', 29)
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .attr('class', 'fixed-indicator')
            .style('opacity', d => (d.fx !== undefined && d.fx !== null) ? 1 : 0);
        
        // Add node labels
        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('pointer-events', 'none')
            .text(d => d.name);
        
        // Add interval range labels below nodes
        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', 40)
            .attr('fill', '#333')
            .attr('font-size', '11px')
            .attr('pointer-events', 'none')
            .text(d => `[${d.start.toFixed(1)}, ${d.end.toFixed(1)}]`);
        
        // Add title for tooltips
        node.append('title')
            .text(d => {
                const fixedStatus = (d.fx !== undefined && d.fx !== null) ? ' (Fixed)' : ' (Free)';
                return `${d.name}: [${d.start.toFixed(1)}, ${d.end.toFixed(1)}]${fixedStatus}\nDrag to reposition, Click to toggle fix`;
            });
        
        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }
    
    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        // Store initial position to detect actual dragging
        this.dragStartPos = { x: event.x, y: event.y };
        this.actuallyDragged = false;
    }
    
    dragging(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        
        // Check if we actually moved
        if (this.dragStartPos) {
            const dx = event.x - this.dragStartPos.x;
            const dy = event.y - this.dragStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 5) { // Threshold for actual drag
                this.actuallyDragged = true;
            }
        }
    }
    
    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        
        if (this.actuallyDragged) {
            // Only keep fixed if we actually dragged
            // Update the fixed indicator
            d3.selectAll('.graph-node').each(function(nodeData) {
                if (nodeData && nodeData.id === d.id) {
                    d3.select(this).select('.fixed-indicator').style('opacity', 1);
                }
            });
        } else {
            // If we didn't actually drag, toggle the fix state
            this.toggleNodeFix(d);
        }
        
        this.dragStartPos = null;
        this.actuallyDragged = false;
    }
    
    toggleNodeFix(d) {
        if (d.fx !== undefined && d.fx !== null) {
            // Unfix the node
            d.fx = null;
            d.fy = null;
            
            // Update visual indicator
            d3.selectAll('.graph-node').each(function(nodeData) {
                if (nodeData && nodeData.id === d.id) {
                    d3.select(this).select('.fixed-indicator').style('opacity', 0);
                }
            });
            
            // Restart simulation to let it move
            this.simulation.alpha(0.3).restart();
        } else {
            // Fix the node at current position
            d.fx = d.x;
            d.fy = d.y;
            
            // Update visual indicator
            d3.selectAll('.graph-node').each(function(nodeData) {
                if (nodeData && nodeData.id === d.id) {
                    d3.select(this).select('.fixed-indicator').style('opacity', 1);
                }
            });
        }
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new IntervalGraphVisualizer();
});

