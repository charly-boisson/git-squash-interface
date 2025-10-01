export function renderHtml(commits: any[], currentBranch: string): string {
    const colorMap: Record<string, string> = {};
    const colors = ["#e53935","#1e88e5","#43a047","#fb8c00","#8e24aa","#00acc1","#fdd835"];
    let colorIndex = 0;

    const headKey = "HEAD";
    const originKey = `origin/main`; // 👉 peut être rendu dynamique avec currentBranch

    function getRefColor(ref: string): string {
        if (!ref) {return "#888";}

        // HEAD et origin/main => même couleur
        if (ref === headKey || ref === originKey) {
            if (colorMap[headKey]) {return colorMap[headKey];}
            colorMap[headKey] = colors[colorIndex++ % colors.length];
            colorMap[originKey] = colorMap[headKey];
            return colorMap[headKey];
        }

        if (!colorMap[ref]) {
            colorMap[ref] = colors[colorIndex++ % colors.length];
        }
        return colorMap[ref];
    }

    const refSeen: Record<string, boolean> = {};
    let lastColor: string | null = null;

    return `
        <html>
        <head>
            <style>
                body {
                    font-family: "Segoe UI", sans-serif;
                    font-size: 13px;
                    margin: 0;
                    padding: 0;
                    background: var(--vscode-sideBar-background);
                    color: var(--vscode-sideBar-foreground);
                    user-select: none;
                }
                table { width: 100%; border-collapse: collapse; }
                tr { cursor: pointer; }
                tr:hover { background: var(--vscode-list-hoverBackground); }
                tr.focused {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                td { padding: 2px 6px; vertical-align: middle; text-align: left; }
                td.graph { width: 16px; }
                td.msg, td.refs, td.author, td.date {
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                td.msg { max-width: 400px; }
                td.refs span {
                    display:inline-block;
                    margin-left:4px;
                    padding:0 6px;
                    border-radius:6px;
                    font-size:11px;
                    font-weight:500;
                    color: #fff;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                ul.context-menu {
                    display:none; 
                    position:absolute; 
                    background: var(--vscode-editorWidget-background); 
                    border: 1px solid var(--vscode-editorWidget-border); 
                    list-style:none; 
                    padding:4px 0; 
                    margin:0;
                }
                ul.context-menu li {
                    padding:4px 12px; 
                    cursor:pointer;
                }
                ul.context-menu li:hover {
                    background: var(--vscode-list-hoverBackground);
                }
            </style>
        </head>
        <body>
            <table id="commits-table">
                ${commits.map((c) => {
                    let refs = (c.refs || "")
                        .split(",")
                        .map((r: string) => r.trim())
                        .filter(Boolean);

                    // Déterminer refKey pour couleur
                    let refKey = refs[0] || "default";
                    if (refKey === "default") {refSeen["default"] = true;}

                    let color: string;
                    if (refs.length > 0) {
                        color = getRefColor(refKey);
                        lastColor = color;
                    } else {
                        color = lastColor || "#888";
                    }

                    // Graph cercle/trait
                    let graphSvg: string;
                    if (!refSeen[refKey]) {
                        graphSvg = `<svg width="12" height="12">
                            <circle cx="6" cy="6" r="4" fill="${color}" />
                        </svg>`;
                        refSeen[refKey] = true;
                    } else {
                        graphSvg = `<svg width="12" height="12">
                            <line x1="6" y1="0" x2="6" y2="12" stroke="${color}" stroke-width="2"/>
                        </svg>`;
                    }

                    // Chips → seulement UNE ref prioritaire
                    let displayRef: string | null = null;
                    if (refs.includes(headKey)) {
                        displayRef = headKey;
                    } else if (refs.includes(originKey)) {
                        displayRef = originKey;
                    } else if (refs.length > 0) {
                        displayRef = refs[0];
                    }

                    let refsHtml = "";
                    if (displayRef) {
                        const rColor = getRefColor(displayRef);
                        refsHtml = `<span style="background:${rColor}" title="${displayRef}">${displayRef}</span>`;
                    }

                    return `
                    <tr data-hash="${c.hash}" oncontextmenu="showContextMenu(event, '${c.hash}')">
                        <td class="graph">${graphSvg}</td>
                        <td class="msg" title="${c.msg}">${c.msg}</td>
                        <td class="refs">${refsHtml}</td>
                        <td class="author" title="${c.author}">${c.author}</td>
                        <td class="date" title="${c.date}">${c.date}</td>
                    </tr>`;
                }).join("")}
            </table>

            <ul id="context-menu" class="context-menu"></ul>

            <script>
                const vscode = acquireVsCodeApi();
                let currentHash = null;
                const menu = document.getElementById('context-menu');
                let lastClickedRow = null;
                const rows = Array.from(document.querySelectorAll("#commits-table tr"));

                function showContextMenu(e, hash) {
                    e.preventDefault();
                    currentHash = hash;
                    const selected = rows.filter(r => r.classList.contains("focused"));
                    menu.innerHTML = "";

                    if (selected.length > 1) {
                        menu.innerHTML += '<li onclick="squashCommits()">Squash les commits sélectionnés</li>';
                    } else if (selected.length === 1) {
                        menu.innerHTML += '<li onclick="copySelectedHash()">Copier le hash</li>';
                        menu.innerHTML += '<li onclick="renameCommit()">Renommer le commit</li>';
                    }

                    menu.style.left = e.pageX + "px";
                    menu.style.top = e.pageY + "px";
                    menu.style.display = "block";
                }

                function copySelectedHash() {
                    if (currentHash) {
                        vscode.postMessage({ command: "copyHash", hash: currentHash });
                    }
                    menu.style.display = "none";
                }

                function renameCommit() {
                    if (currentHash) {
                        vscode.postMessage({ command: "renameCommit", hash: currentHash });
                    }
                    menu.style.display = "none";
                }

                function squashCommits() {
                    const selected = rows.filter(r => r.classList.contains("focused"))
                                        .map(r => r.dataset.hash);
                    if (selected.length > 1) {
                        vscode.postMessage({ command: "squashCommits", hashes: selected });
                    }
                    menu.style.display = "none";
                }

                rows.forEach((row, idx) => {
                    row.addEventListener("click", (e) => {
                        if (e.ctrlKey) {
                            row.classList.toggle("focused");
                        } else if (e.shiftKey && lastClickedRow) {
                            const start = rows.indexOf(lastClickedRow);
                            const end = idx;
                            const [min, max] = [Math.min(start, end), Math.max(start, end)];
                            rows.forEach((r, i) => {
                                if (i >= min && i <= max) r.classList.add("focused");
                            });
                        } else {
                            rows.forEach(r => r.classList.remove("focused"));
                            row.classList.add("focused");
                        }
                        lastClickedRow = row;
                    });
                });

                document.addEventListener("click", () => { menu.style.display = "none"; });
            </script>
        </body>
        </html>
    `;
}
