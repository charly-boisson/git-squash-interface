import * as vscode from 'vscode';
import { getCommits, getCurrentBranch } from '../services/gitService';
import { renderHtml } from '../services/htmlRenderer';
import { copyHash } from '../actions/copyHash';
import { renameCommit } from '../actions/renameCommit';
import { squashCommits } from '../actions/squashCommits';
import { exec } from "child_process";

export class CommitsWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    constructor(private readonly extensionUri: vscode.Uri) {}

    public async resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        await this.refresh();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "copyHash") {
                copyHash(message.hash);
            }
            if (message.command === "renameCommit") {
                renameCommit(message.hash, () => this.refresh());
            }
            if (message.command === "squashCommits") {
                squashCommits(message.hashes, () => this.refresh());
            }
        });
    }

    public async refresh() {
        if (!this._view) {return;}
        const commits = await getCommits();
        const currentBranch = await getCurrentBranch();
        this._view.webview.html = renderHtml(commits, currentBranch);
    }

    public forceRefresh() {
        this.refresh();
    }
}
