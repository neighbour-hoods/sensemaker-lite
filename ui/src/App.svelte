<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { AppWebsocket, ActionHash, InstalledAppInfo } from '@holochain/client';
  import '@material/mwc-circular-progress';

  import { appWebsocketContext, appInfoContext } from './contexts';
  import CreateRange from './components/sensemaker_dna/sensemaker/CreateRange.svelte';
import RangeDetail from './components/sensemaker_dna/sensemaker/RangeDetail.svelte';

  let appWebsocket: AppWebsocket | undefined;
  let appInfo: InstalledAppInfo | undefined;
  let loading = true;
  let actionHash: ActionHash | undefined;

  $: appWebsocket, appInfo, actionHash, loading;

  onMount(async () => {
    appWebsocket = await AppWebsocket.connect(`ws://localhost:${process.env.HC_PORT}`);

    appInfo = await appWebsocket.appInfo({
      installed_app_id: 'sensemaker_happ',
    });
    loading = false;
  });

  setContext(appWebsocketContext, {
    getAppWebsocket: () => appWebsocket,
  });

  setContext(appInfoContext, {
    getAppInfo: () => appInfo,
  });
</script>

<main>
  {#if loading}
    <div style="display: flex; flex: 1; align-items: center; justify-content: center">
      <mwc-circular-progress indeterminate />
    </div>
  {:else}
    <CreateRange on:range-created="{e => actionHash = e.detail.actionHash}"></CreateRange>

    {#if actionHash}
      <RangeDetail actionHash={actionHash}></RangeDetail>
    {/if}
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
