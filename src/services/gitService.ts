import { exec } from 'child_process';
import * as vscode from 'vscode';

export interface Commit {
    hash: string;
    refs: string;
    msg: string;
    author: string;
    date: string;
}

export async function getCommits(limit = 50): Promise<Commit[]> {
    return new Promise(resolve => {
        const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!repoPath) { return resolve([]); }

        const cmd = `git log --graph --pretty=format:"%H%x09%d%x09%s%x09%an%x09%ar" -n ${limit}`;

        exec(cmd, { cwd: repoPath }, (err, stdout) => {
            if (err) { return resolve([]); }

            const lines = stdout.split("\n").filter(Boolean);
            const commits = lines.map(line => {
                const parts = line.split("\t");
                return {
                    hash: parts[0].replace(/^[*|\\/ ]+/, "").trim(),
                    refs: parts[1].trim().replace(/[()]/g, ""),
                    msg: parts[2].trim(),
                    author: parts[3].trim(),
                    date: parts[4].trim()
                };
            });

            resolve(commits);
        });
    });
}



export async function getCurrentBranch(): Promise<string> {
    return new Promise(resolve => {
        const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!repoPath) {return resolve("HEAD");}

        exec("git rev-parse --abbrev-ref HEAD", { cwd: repoPath }, (err, stdout) => {
            if (err) {return resolve("HEAD");}
            resolve(stdout.trim());
        });
    });
}