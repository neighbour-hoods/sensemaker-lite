# Sensemaker-Lite has been Archived

This repo has been merged into the https://github.com/neighbour-hoods/nh-launcher repo.

<h1 align="center">
  <div>👋 Welcome to</div>
  <img src="https://neighbourhoods.network/visual-assets/nh-white-banner.png" alt="Logo" width="500">
  <div>Sensemaker-Lite</div>
</h1>

<div align="center">

[![Join the Neighbourhoods discord server](https://img.shields.io/discord/854211588184735774.svg?label=&logo=discord&logoColor=ffffff&color=5865F2)](https://discord.gg/neighbourhoods)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg?)](https://github.com/neighbour-hoods/sensemaker-lite/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
[![made with hearth by neighbourhoods](https://img.shields.io/badge/made%20with%20%E2%99%A5%20-cc14cc.svg?)](https://github.com/neighbour-hoods)

</div>



## Environment Setup

1. Install the holochain dev environment (only nix-shell is required): https://developer.holochain.org/docs/install/
2. Enable Holochain cachix with:

```bash
nix-env -iA cachix -f https://cachix.org/api/v1/install
cachix use holochain-ci
```

3. Clone this repo and `cd` inside of it.
4. Enter the nix shell by running this in the root folder of the repository: 

```bash
nix-shell
npm install
```

This will install all the needed dependencies in your local environment, including `holochain`, `hc` and `npm`.

Run all the other instructions in this README from inside this nix-shell, otherwise **they won't work**.

## Bootstrapping a network

Create a whole network of nodes connected to each other and their respective UIs with.

```bash
npm run network 3
```

Substitute the "3" for the number of nodes that you want to bootstrap in your network.

This will also bring up the Holochain Playground for advanced introspection of the conductors.

## Running an agent
 
If you only want to run a single conductor and a UI connected to it:

```bash
npm start
```

To run another agent, open another terminal, and execute again:

```bash
npm start
```

Each new agent that you create this way will get assigned its own port and get connected to the other agents.

## Running the DNA tests

```bash
npm run test
```

## Building the DNA

```bash
npm run build:happ
```

## Package

To package the web happ:

``` bash
npm run package
```

You'll have the `sensemaker_happ.webhapp` in `workdir`. This is what you should distribute so that the Holochain Launcher can install it.

You will also have its subcomponent `sensemaker_happ.happ` in the same folder`.

## Documentation

This repository is using this tooling:

- [NPM Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/): npm v7's built-in monorepo capabilities.
- [hc](https://github.com/holochain/holochain/tree/develop/crates/hc): Holochain CLI to easily manage Holochain development instances.
- [@holochain/tryorama](https://www.npmjs.com/package/@holochain/tryorama): test framework.
- [@holochain/client](https://www.npmjs.com/package/@holochain/client): client library to connect to Holochain from the UI.
- [@holochain-playground/cli](https://www.npmjs.com/package/@holochain-playground/cli): introspection tooling to understand what's going on in the Holochain nodes.
