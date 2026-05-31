param(
    [string]$Branch = 'main',
    [string]$CommitMessage = 'chore(ci): add GitHub Actions workflows and docs'
)

Write-Host "Starting push and workflow trigger helper"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git not found in PATH. Install Git and try again."
    exit 1
}

# Stage files we changed
git add .github README.md docs/improvements.md docs/plan.md

$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to commit"
} else {
    git commit -m "$CommitMessage"
}

Write-Host "Pushing to branch '$Branch'..."
git push origin $Branch

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "gh CLI not found. Install GitHub CLI to trigger workflows programmatically, or trigger the workflow from the Actions tab in GitHub." 
    exit 0
}

Write-Host "Triggering 'Apply Changes (manual)' workflow via gh..."
gh workflow run "Apply Changes (manual)" --ref $Branch

Write-Host "Triggered workflow. You can view runs with: gh run list --workflow 'Apply Changes (manual)'"
