#!/usr/bin/env python3
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
import numpy as np

# Set style
plt.style.use('seaborn-v0_8-darkgrid')
fig, ax = plt.subplots(figsize=(14, 7))

# Commit data
dates = [
    '2025-12-07', '2025-12-08', '2025-12-13', '2025-12-14',
    '2025-12-15', '2025-12-16', '2025-12-19', '2025-12-22', '2025-12-25'
]
commits = [6, 4, 8, 18, 7, 1, 1, 3, 2]

# Convert dates
date_objects = [datetime.strptime(d, '%Y-%m-%d') for d in dates]

# Create bar chart
bars = ax.bar(date_objects, commits, width=0.8,
              color='#667eea', edgecolor='#764ba2', linewidth=2, alpha=0.85)

# LLM milestones
milestones = [
    {'date': '2024-10-22', 'label': 'Claude Sonnet 4.5', 'color': '#10b981'},
    {'date': '2024-11-01', 'label': 'Claude Opus 4.5', 'color': '#f59e0b'},
    {'date': '2024-11-05', 'label': 'Claude Code GA', 'color': '#3b82f6'},
    {'date': '2024-12-11', 'label': 'Gemini 2.0 Flash', 'color': '#8b5cf6'},
    {'date': '2024-12-17', 'label': 'o1 Full Release', 'color': '#ec4899'},
]

# Plot milestone lines
y_max = max(commits) + 2
for i, milestone in enumerate(milestones):
    milestone_date = datetime.strptime(milestone['date'], '%Y-%m-%d')
    ax.axvline(x=milestone_date, color=milestone['color'],
              linestyle='--', linewidth=2, alpha=0.7, zorder=1)

    # Add labels rotated vertically
    y_pos = y_max - (i % 3) * 1.5 - 1
    ax.text(milestone_date, y_pos, milestone['label'],
           rotation=90, verticalalignment='bottom',
           fontsize=9, fontweight='bold', color=milestone['color'],
           bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                    edgecolor=milestone['color'], alpha=0.8))

# Formatting
ax.set_xlabel('Date', fontsize=13, fontweight='bold')
ax.set_ylabel('Number of Commits', fontsize=13, fontweight='bold')
ax.set_title('Flow Repository - Commit Timeline with LLM Milestones',
            fontsize=16, fontweight='bold', pad=20,
            color='#333')

# Set x-axis limits and formatting
ax.set_xlim(datetime(2024, 10, 1), datetime(2025, 12, 27))
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
ax.xaxis.set_major_locator(mdates.MonthLocator())
ax.xaxis.set_minor_locator(mdates.WeekdayLocator())

# Grid
ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
ax.set_axisbelow(True)

# Y-axis
ax.set_ylim(0, y_max)
ax.yaxis.set_major_locator(plt.MultipleLocator(2))

# Rotate x-axis labels
plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')

# Add statistics box
stats_text = f'''Repository Statistics:
• Total Commits: 50
• Peak Day: 18 commits (Dec 14)
• Active Days: 9
• Average: 5.6 commits/day'''

ax.text(0.98, 0.97, stats_text, transform=ax.transAxes,
       fontsize=10, verticalalignment='top', horizontalalignment='right',
       bbox=dict(boxstyle='round,pad=0.8', facecolor='white',
                edgecolor='#667eea', linewidth=2, alpha=0.9))

# Tight layout
plt.tight_layout()

# Save
plt.savefig('commit-timeline.png', dpi=150, bbox_inches='tight',
           facecolor='white', edgecolor='none')
print("Chart saved to commit-timeline.png")
