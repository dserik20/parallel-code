# Remote Access

## Problem

Users running long-lived AI agent tasks on their desktop need a way to monitor progress from their phone or tablet without being at their computer. Currently, there is no way to check on agent status, view terminal output, or interact with agents remotely.

## Motivation

AI coding tasks often run for minutes to hours. Users step away from their desk and lose visibility into what their agents are doing. They want to:

- Glance at their phone to see if a task finished or errored
- Read terminal output from agents working in parallel
- Send input or kill a stuck agent without returning to their desk
- Share a monitoring view with a collaborator on the same network

## Scope

- Real-time remote monitoring of all running agents via WebSocket
- Mobile-optimized web UI served from the Electron app
- Token-based authentication (no account system)
- Works over local WiFi and Tailscale networks
- Read terminal output (scrollback + live stream)
- Send input, resize, and kill agents remotely

## Out of Scope

- Internet-accessible tunneling (ngrok, Cloudflare Tunnel)
- Multi-user access control or permissions
- Persistent session history (scrollback is in-memory only)
- File browsing or diff viewing from the remote UI
