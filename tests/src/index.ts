
import neighbourhood from './sensemaker_dna/sensemaker/neighbourhood.ts';
import sensemaker_community_activator from './sensemaker_dna/sensemaker/community_activator.ts';
import sensemaker_config from './sensemaker_dna/sensemaker/sm_config.ts';
import applet_config from './sensemaker_dna/sensemaker/applet_config.ts';
import range from './sensemaker_dna/sensemaker/range.ts';
import dashboard from './sensemaker_dna/sensemaker/dashboard.ts';
import agent from './sensemaker_dna/sensemaker/agent.ts';
import widget_config from './sensemaker_dna/widget/widget_config.ts';
range();
neighbourhood();
applet_config();
sensemaker_config();
sensemaker_community_activator();
dashboard();
agent();
widget_config();
