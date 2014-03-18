function setOverrides() {
  // Set all cycleable preferences
  _.keys(FrozenCookies.preferenceValues).forEach(function(preference) {
    FrozenCookies[preference] = preferenceParse(preference, FrozenCookies.preferenceValues[preference].default);
  });
  
  logEvent("Load", "Initial Load of Frozen Cookies v " + FrozenCookies.branch + "." + FrozenCookies.version + ". (You should only ever see this once.)");

  FrozenCookies.frequency = 100;
  FrozenCookies.efficiencyWeight = 1.0;
  
  // Separate because these are user-input values
  FrozenCookies.cookieClickSpeed = preferenceParse('cookieClickSpeed',0);
  FrozenCookies.frenzyClickSpeed = preferenceParse('frenzyClickSpeed',0);
  
  // Becomes 0 almost immediately after user input, so default to 0
  FrozenCookies.timeTravelAmount = 0;
  
  // Get historical data
  FrozenCookies.non_gc_time = Number(localStorage.getItem('nonFrenzyTime'));
  FrozenCookies.gc_time = Number(localStorage.getItem('frenzyTime'));
  FrozenCookies.lastHCAmount = Number(localStorage.getItem('lastHCAmount'));
  FrozenCookies.lastHCTime = Number(localStorage.getItem('lastHCTime'));
  FrozenCookies.prevLastHCTime = Number(localStorage.getItem('prevLastHCTime'));
  FrozenCookies.maxHCPercent = Number(localStorage.getItem('maxHCPercent'));

  // Set default values for calculations
  FrozenCookies.last_gc_state = (Game.frenzy > 0);
  FrozenCookies.last_gc_time = Date.now();
  FrozenCookies.lastCPS = Game.cookiesPs;
  FrozenCookies.lastCookieCPS = 0;
  FrozenCookies.lastUpgradeCount = 0;
  FrozenCookies.currentBank = {'cost': 0, 'efficiency' : 0};
  FrozenCookies.targetBank = {'cost': 0, 'efficiency' : 0};
  FrozenCookies.disabledPopups = true;
  FrozenCookies.trackedStats = [];
  FrozenCookies.lastGraphDraw = 0;
  
  // Allow autoCookie to run
  FrozenCookies.processing = false;
  FrozenCookies.priceReductionTest = false;
  
  FrozenCookies.cookieBot = 0;
  FrozenCookies.autoclickBot = 0;
  FrozenCookies.autoFrenzyBot = 0;
  FrozenCookies.frenzyClickBot = 0;
  
  // Smart tracking details
  FrozenCookies.smartTrackingBot = 0;
  FrozenCookies.minDelay = 1000 * 10; // 10s minimum reporting between purchases with "smart tracking" on
  FrozenCookies.delayPurchaseCount = 0;
  
  // Caching
  FrozenCookies.recalculateCaches = true;
  FrozenCookies.caches = {};
  FrozenCookies.caches.nextPurchase = {};
  FrozenCookies.caches.recommendationList = [];
  FrozenCookies.caches.buildings = [];
  FrozenCookies.caches.upgrades = [];
  
  if (!blacklist[FrozenCookies.blacklist]) {
    FrozenCookies.blacklist = 'none';
  }
  nextPurchase(true);
  Beautify = fcBeautify;
  Game.sayTime = function(time,detail) {return timeDisplay(time/Game.fps);}
  Game.oldReset = Game.Reset;
  Game.oldWriteSave = Game.WriteSave;
  Game.oldLoadSave = Game.LoadSave;
  Game.Reset = fcReset;
  Game.WriteSave = fcWriteSave;
  Game.LoadSave = fcLoadSave;
  Game.Win = fcWin;
  Game.oldBackground = Game.DrawBackground;
  Game.DrawBackground = function() {Game.oldBackground(); updateTimers();}
  Game.oldDraw = Game.Draw;
  Game.Draw = function() {document.hasFocus() ? Game.oldDraw() : '';}
  // Remove the following when turning on tooltop code
  Game.RebuildStore();
  Game.RebuildUpgrades();
  beautifyUpgradesAndAchievements();
  // Replace Game.Popup references with event logging
  eval("Game.goldenCookie.click = " + Game.goldenCookie.click.toString().replace(/Game\.Popup\((.+)\)\;/g, 'logEvent("GC", $1, true);'));
  eval("Game.UpdateWrinklers = " + Game.UpdateWrinklers.toString().replace(/Game\.Popup\((.+)\)\;/g, 'logEvent("Wrinkler", $1, true);'));
/*
  eval("Game.Draw = " + Game.Draw.toString()
    .replace(/if \(Game.cookies>=me.price\) l\('product'\+me.id\).className='product enabled'; else l\('product'\+me.id\).className='product disabled';/, '(Game.cookies >= me.price) ? $("#product"+me.id).addClass("enabled").removeClass("disabled") : $("#product"+me.id).addClass("disabled").removeClass("enabled");')
    .replace(/if \(Game.cookies>=me.basePrice\) l\('upgrade'\+i\).className='crate upgrade enabled'; else l\('upgrade'\+i\).className='crate upgrade disabled';/, '(Game.cookies >= me.basePrice) ? $("#upgrade"+me.id).addClass("enabled").removeClass("disabled") : $("#upgrade"+me.id).addClass("disabled").removeClass("enabled");'));
  Game.RebuildStore=function(recalculate) {rebuildStore(recalculate);}
  Game.RebuildUpgrades=function(recalculate) {rebuildUpgrades(recalculate);}
  Game.RebuildStore(true);
  Game.RebuildUpgrades(true);
*/
}

function preferenceParse(setting, defaultVal) {
  var value = localStorage.getItem(setting);
  if (typeof(value) == 'undefined' || value == null || isNaN(Number(value))) {
    value = defaultVal;
    localStorage.setItem(setting, value);
  }
  return Number(value);
}

// var full_history = [];  // This may be a super leaky thing

function formatEveryThirdPower(notations) {
  return function (value) {
    var base = 0,
      notationValue = '';
    if (value >= 1000000 && Number.isFinite(value)) {
      value /= 1000;
      while(Math.round(value) >= 1000){
        value /= 1000;
        base++;
      }
      if (base > notations.length) {
        return 'Infinity';
      } else {
        notationValue = notations[base];
      }
    }
    return ( Math.round(value * 1000) / 1000.0 ) + notationValue;
  };
}

function scientificNotation(value) {
  if (value === 0 || !Number.isFinite(value) || (Math.abs(value) > 1 && Math.abs(value) < 100)) {
    return rawFormatter(value);
  }
  var sign = value > 0 ? '' : '-';
  value = Math.abs(value);
  var exp = Math.floor(Math.log(value)/Math.LN10);
  var num = Math.round((value/Math.pow(10, exp)) * 100) / 100;
  var output = num.toString();
  if (num === Math.round(num)) {
    output += '.00';
  } else if (num * 10 === Math.round(num * 10)) {
    output += '0';
  }
  return sign + output + '*10^' + exp;
}

function rawFormatter(value) {
  return Math.round(value * 1000) / 1000;
}

var numberFormatters = [
  rawFormatter,
  formatEveryThirdPower([
    '',
    ' million',
    ' billion',
    ' trillion',
    ' quadrillion',
    ' quintillion',
    ' sextillion',
    ' septillion'
  ]),

  formatEveryThirdPower([
    '',
    ' M',
    ' B',
    ' T',
    ' Qa',
    ' Qi',
    ' Sx',
    ' Sp'
  ]),

  formatEveryThirdPower([
    '',
    ' M',
    ' G',
    ' T',
    ' P',
    ' E',
    ' Z',
    ' Y'
  ]),
  scientificNotation
];

function fcBeautify (value) {
  var negative = (value < 0);
  value = Math.abs(value);
  var formatter = numberFormatters[FrozenCookies.numberDisplay];
  var output = formatter(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? '-' + output : output;
}

// Runs numbers in upgrades and achievements through our beautify function
function beautifyUpgradesAndAchievements() {
  function beautifyFn(str) {
    return Beautify(parseInt(str.replace(/,/, ''), 10));
  }

  var numre = /\d\d?\d?(?:,\d\d\d)*/;
  Game.AchievementsById.forEach(function (ach) {
    ach.desc = ach.desc.replace(numre, beautifyFn);
  });

  // These might not have any numbers in them, but just in case...
  Game.UpgradesById.forEach(function (upg) {
    upg.desc = upg.desc.replace(numre, beautifyFn);
  });
}

function timeDisplay(seconds) {
  if (seconds === '---' || seconds === 0) {
    return 'Done!';
  } else if (seconds == Number.POSITIVE_INFINITY) {
    return 'Never!'
  }
  seconds = Math.floor(seconds);
  var days, hours, minutes;
  days = Math.floor(seconds / (24 * 60 * 60));
  days = (days > 0) ? Beautify(days) + 'd ' : '';
  seconds %= (24 * 60 * 60);
  hours = Math.floor(seconds / (60 * 60));
  hours = (hours > 0) ? hours + 'h ' : '';
  seconds %= (60 * 60);
  minutes = Math.floor(seconds / 60);
  minutes = (minutes > 0) ? minutes + 'm ' : '';
  seconds %= 60;
  seconds = (seconds > 0) ? seconds + 's' : '';
  return (days + hours + minutes + seconds).trim();
}

function fcReset(bypass) {
  Game.oldReset(bypass);
  FrozenCookies.nonFrenzyTime = 0;
  FrozenCookies.frenzyTime = 0;
  FrozenCookies.last_gc_state = (Game.frenzy > 0);
  FrozenCookies.last_gc_time = Date.now();
  FrozenCookies.lastHCAmount = Game.HowMuchPrestige(Game.cookiesEarned + Game.cookiesReset);
  FrozenCookies.lastHCTime = Date.now();
  FrozenCookies.maxHCPercent = 0;
  FrozenCookies.prevLastHCTime = Date.now();
  FrozenCookies.lastCps = 0;
  updateLocalStorage();
  recommendationList(true);
}

function fcLoadSave(data) {
  var res = Game.oldLoadSave(data);
  if (FrozenCookies.saveWrinklers && localStorage.wrinklers && !data) {
    Game.wrinklers = JSON.parse(localStorage.wrinklers);
  }
  return res;
}

function fcWriteSave(exporting) {
  if (FrozenCookies.saveWrinklers && Game.wrinklers) {
    localStorage.wrinklers = JSON.stringify(Game.wrinklers);
  }
  return Game.oldWriteSave(exporting);
}

function updateLocalStorage() {
  _.keys(FrozenCookies.preferenceValues).forEach(function(preference) {
    localStorage[preference] = FrozenCookies[preference];
  });
  
  localStorage.frenzyClickSpeed = FrozenCookies.frenzyClickSpeed;
  localStorage.cookieClickSpeed = FrozenCookies.cookieClickSpeed;
  localStorage.nonFrenzyTime = FrozenCookies.non_gc_time;
  localStorage.frenzyTime = FrozenCookies.gc_time;
  localStorage.lastHCAmount = FrozenCookies.lastHCAmount;
  localStorage.maxHCPercent = FrozenCookies.maxHCPercent;
  localStorage.lastHCTime = FrozenCookies.lastHCTime;
  localStorage.prevLastHCTime = FrozenCookies.prevLastHCTime;
}

function divCps(value, cps) {
  var result = 0;
  if (value) {
    if (cps) {
      result = value / cps;
    } else {
      result = Number.POSITIVE_INFINITY;
    }
  }
  return result;
}

function nextHC(tg) {
  var futureHC = Math.ceil(Math.sqrt((Game.cookiesEarned + Game.cookiesReset)/0.5e12+0.25)-0.5);
  var nextHC = futureHC*(futureHC+1)*0.5e12;
  var toGo = nextHC - (Game.cookiesEarned + Game.cookiesReset);
  return tg ? toGo : timeDisplay(divCps(toGo, Game.cookiesPs));
}

function copyToClipboard (text) {
  window.prompt ("Copy to clipboard: Ctrl+C, Enter", text);
}
 
function getBuildingSpread () {
  return Game.ObjectsById.map(function(a){return a.amount;}).join('/')
}

// Press 'b' to pop up a copyable window with building spread. 
document.addEventListener('keydown', function(event) {
  if(event.keyCode == 66) {
    copyToClipboard(getBuildingSpread());
  }
});

// Press 'a' to toggle autobuy.
document.addEventListener('keydown', function(event) {
  if(event.keyCode == 65) {
    Game.Toggle('autoBuy','autobuyButton','Autobuy OFF','Autobuy ON');
    toggleFrozen('autoBuy');
  }
});

// Press 'c' to toggle auto-GC
document.addEventListener('keydown', function(event) {
  if(event.keyCode == 67) {
    Game.Toggle('autoGC','autogcButton','Autoclick GC OFF','Autoclick GC ON');
    toggleFrozen('autoGC');
  }
});

function writeFCButton(setting) {
  var current = FrozenCookies[setting];
}

function getSpeed(current) {
  var newSpeed = prompt('How many times per second do you want to click? (Current maximum is 250 clicks per second)',current);
  if (typeof(newSpeed) == 'undefined' || newSpeed == null || isNaN(Number(newSpeed)) || Number(newSpeed) < 0 || Number(newSpeed) > 250) {
    newSpeed = current;
  }
  return Number(newSpeed);
}

function updateSpeed(base) {
  var newSpeed = getSpeed(FrozenCookies[base]);
  if (newSpeed != FrozenCookies[base]) {
    FrozenCookies[base] = newSpeed;
    updateLocalStorage();
    FCStart();
  }
}

function updateTimeTravelAmount() {
  var newAmount = prompt("Warning: Time travel is highly unstable, and large values are highly likely to either cause long delays or crash the game. Be careful!\nHow much do you want to time travel by? This will happen instantly.");
  if (typeof(newAmount) === 'undefined' || newAmount === null || isNaN(Number(newAmount)) || Number(newAmount) < 0) {
    newAmount = 0;
  }
  FrozenCookies.timeTravelAmount = newAmount;
}

function cyclePreference(preferenceName) {
  var preference = FrozenCookies.preferenceValues[preferenceName];
  if (preference) {
    var display = preference.display;
    var current = FrozenCookies[preferenceName];
    var preferenceButton = $('#' + preferenceName + 'Button');
    if (display && display.length > 0 && preferenceButton && preferenceButton.length > 0) {
      var newValue = (current + 1) % display.length;
      preferenceButton[0].innerText = display[newValue];
      FrozenCookies[preferenceName] = newValue;
      updateLocalStorage();
      FrozenCookies.recalculateCaches = true;
      Game.RebuildStore();
      Game.RebuildUpgrades();
      FCStart();
    }  
  }
}

function toggleFrozen(setting) {
  if (!Number(localStorage.getItem(setting))) {
    localStorage.setItem(setting,1);
    FrozenCookies[setting] = 1;
  } else {
    localStorage.setItem(setting,0);
    FrozenCookies[setting] = 0;
  }
  FCStart();
}

function autoBlacklistOff() {
  switch (FrozenCookies.blacklist) {
    case 1:
      FrozenCookies.blacklist = (Game.cookiesEarned >= 1000000) ? 0 : 1;
      break;
    case 2:
      FrozenCookies.blacklist = (Game.cookiesEarned >= 1000000000) ? 0 : 2;
      break;
    case 3:
      FrozenCookies.blacklist = haveAllHalloween() ? 0 : 3;
      break;
  }
}

function getProbabilityList(listType) {
  return cumulativeProbabilityList[listType][getProbabilityModifiers(listType)];
}

function getProbabilityModifiers(listType) {
  switch (listType) {
    case "golden":
      return Game.Has('Lucky day') + Game.Has('Serendipity');
    case "reindeer":
      return Game.Has('Reindeer baking grounds');
  }
  return 0;
}

function cumulativeProbability(listType, start, stop) {
  return 1 - ((1 - getProbabilityList(listType)[stop]) / (1 - getProbabilityList(listType)[start]));
}

function probabilitySpan(listType, start, endProbability) {
  var startProbability = getProbabilityList(listType)[start];
  return _.sortedIndex(getProbabilityList(listType), (startProbability + endProbability - startProbability * endProbability));
}

function baseCps() {
  var frenzyMod = (Game.frenzy > 0) ? Game.frenzyPower : 1;
  return Game.cookiesPs / frenzyMod;
}

function baseClickingCps(clickSpeed) {
  var clickFrenzyMod = (Game.clickFrenzy > 0) ? 777 : 1;
  var frenzyMod = (Game.frenzy > 0) ? Game.frenzyPower : 1;
  var cpc = Game.mouseCps() / (clickFrenzyMod * frenzyMod);
  return clickSpeed * cpc;
}

function effectiveCps(delay) {
  var wrinklerMod = (Game.elderWrath && (!FrozenCookies.autoWrinkler || (FrozenCookies.autoWrinkler && haveAllHalloween()))) ? 6 : 1;
  if (delay == null) {
    delay = delayAmount();
  }
  return baseCps() * wrinklerMod + gcPs(cookieValue(delay)) + baseClickingCps(FrozenCookies.cookieClickSpeed) + reindeerCps();
}

function frenzyProbability() {
  var wrathValue = Game.elderWrath;
  return cookieInfo.frenzy.odds[wrathValue] + cookieInfo.frenzyRuin.odds[wrathValue] + cookieInfo.frenzyLucky.odds[wrathValue] + cookieInfo.frenzyClick.odds[wrathValue];
}

function clotProbability() {
  var wrathValue = Game.elderWrath;
  return cookieInfo.clot.odds[wrathValue] + cookieInfo.clotRuin.odds[wrathValue] + cookieInfo.clotLucky.odds[wrathValue] + cookieInfo.clotClick.odds[wrathValue];
}

function bloodProbability() {
  var wrathValue = Game.elderWrath;
  return cookieInfo.blood.odds[wrathValue];
}

function cookieValue(bankAmount) {
  var cps = baseCps();
  var clickCps = baseClickingCps(FrozenCookies.autoClick * FrozenCookies.cookieClickSpeed);
  var frenzyCps = FrozenCookies.autoFrenzy ? baseClickingCps(FrozenCookies.autoFrenzy * FrozenCookies.frenzyClickSpeed) : clickCps;
  var luckyMod = Game.Has('Get lucky') ? 2 : 1;
  var clickFrenzyMod = (Game.clickFrenzy > 0) ? 777 : 1
  var wrathValue = Game.elderWrath;
  
  var wrinklerMod = (Game.elderWrath && (!FrozenCookies.autoWrinkler || (FrozenCookies.autoWrinkler && haveAllHalloween()))) ? 6 : 1;
  var value = 0;
  // Clot
  value -= cookieInfo.clot.odds[wrathValue] * (cps + clickCps) * luckyMod * wrinklerMod * 66 * 0.5;
  // Frenzy
  value += cookieInfo.frenzy.odds[wrathValue] * (cps + clickCps) * luckyMod * wrinklerMod * 77 * 7;
  // Blood
  value += cookieInfo.blood.odds[wrathValue] * (cps + clickCps) * luckyMod * wrinklerMod * 666 * 6;
  // Chain
  value += cookieInfo.chain.odds[wrathValue] * calculateChainValue(bankAmount, cps, (7 - (wrathValue / 3)));
  // Ruin
  value -= cookieInfo.ruin.odds[wrathValue] * (Math.min(bankAmount * 0.05, cps * 60 * 10) + 13);
  // Frenzy + Ruin
  value -= cookieInfo.frenzyRuin.odds[wrathValue] * (Math.min(bankAmount * 0.05, cps * 60 * 10 * 7) + 13);
  // Clot + Ruin
  value -= cookieInfo.clotRuin.odds[wrathValue] * (Math.min(bankAmount * 0.05, cps * 60 * 10 * 0.5) + 13);
  // Lucky
  value += cookieInfo.lucky.odds[wrathValue] * (Math.min(bankAmount * 0.1, cps * 60 * 20) + 13);
  // Frenzy + Lucky
  value += cookieInfo.frenzyLucky.odds[wrathValue] * (Math.min(bankAmount * 0.1, cps * 60 * 20 * 7) + 13);
  // Clot + Lucky
  value += cookieInfo.clotLucky.odds[wrathValue] * (Math.min(bankAmount * 0.1, cps * 60 * 20 * 0.5) + 13);
  // Click
  value += cookieInfo.click.odds[wrathValue] * frenzyCps * luckyMod * 13 * 777;
  // Frenzy + Click
  value += cookieInfo.frenzyClick.odds[wrathValue] * frenzyCps * luckyMod * 13 * 777 * 7;
  // Clot + Click
  value += cookieInfo.clotClick.odds[wrathValue] * frenzyCps * luckyMod * 13 * 777 * 0.5;
  // Blah
  value += 0;
  return value;
}

function reindeerValue() {
  var value = 0;
  if (Game.season == 'christmas') {
    var remaining = 1 - (frenzyProbability() + clotProbability() + bloodProbability());
    var outputMod = Game.Has('Ho ho ho-flavored frosting') ? 2 : 1;
    
    value += Math.max(25, baseCps() * outputMod * 60 * 7) * frenzyProbability();
    value += Math.max(25, baseCps() * outputMod * 60 * 0.5) * clotProbability();
    value += Math.max(25, baseCps() * outputMod * 60 * 666) * bloodProbability();
    value += Math.max(25, baseCps() * outputMod * 60) * remaining;
  }
  return value;
}

function reindeerCps() {
  var averageTime = probabilitySpan('reindeer', 0, 0.5) / Game.fps;
  return reindeerValue() / averageTime * FrozenCookies.simulatedGCPercent;
}

function calculateChainValue(bankAmount, cps, digit) { 
  x = Math.min(bankAmount, (cps * 60 * 60 * 6 * 4));
  n = Math.floor(Math.log((9*x)/(4*digit))/Math.LN10);
  return 125 * Math.pow(9,(n-3)) * digit;
}

/* Old way, less efficient
function calculateChainValue(bankAmount, cps) {
  var payoutTotal = 0;
  var payoutNext = '6';
  var step = 1;
  var remainingProbability = 1;
  while (payoutNext < bankAmount * 0.25 || payoutNext <= cps * 60 * 60 * 6) {
    step += 1;
    payoutTotal += remainingProbability * 0.1 * payoutNext;
    remainingProbability -= remainingProbability * 0.1
    payoutNext += '6';
  }
  payoutTotal += remainingProbability * payoutNext.substr(0,payoutNext.length-1);
  return payoutTotal;
}
*/

function luckyBank() {
  return baseCps() * 60 * 20 * 10;
}

function luckyFrenzyBank() {
  return baseCps() * 60 * 20 * 7 * 10;
}

function chainBank() {
//  More exact
  var digit = 7 - Math.floor(Game.elderWrath / 3);
  return 4 * Math.floor(digit / 9 * Math.pow(10, Math.floor(Math.log(194400*baseCps()/digit)/Math.LN10 )));
//  return baseCps() * 60 * 60 * 6 * 4;
}

function cookieEfficiency(startingPoint, bankAmount) {
  var results = Number.MAX_VALUE;
  var currentValue = cookieValue(startingPoint);
  var bankValue = cookieValue(bankAmount);
  var bankCps = gcPs(bankValue);
  if (bankCps > 0) {
    if (bankAmount <= startingPoint) {
      results = 0;
    } else {
      var cost = Math.max(0,(bankAmount - startingPoint));
      var deltaCps = gcPs(bankValue - currentValue);
      results = divCps(cost, deltaCps);
    }
  } else if (bankAmount <= startingPoint) {
    results = 0;
  }
  return results;
}

function bestBank(minEfficiency) {
  var results = {};
  var bankLevels = [0, luckyBank(), luckyFrenzyBank(), chainBank()].sort(function(a,b){return b-a;}).map(function(bank){
    return {'cost': bank, 'efficiency': cookieEfficiency(Game.cookies, bank)};
  }).filter(function(bank){
    return (bank.efficiency <= minEfficiency) ? bank : null;
  });
  return bankLevels[0];
}

function weightedCookieValue(useCurrent) {
  var cps = baseCps();
  var lucky_mod = Game.Has('Get lucky');
  var base_wrath = lucky_mod ? 401.835 * cps : 396.51 * cps;
//  base_wrath += 192125500000;
  var base_golden = lucky_mod ? 2804.76 * cps : 814.38 * cps;
  if (Game.cookiesEarned >= 100000) {
    var remainingProbability = 1;
    var startingValue = '6666';
    var rollingEstimate = 0;
    for (var i = 5; i < Math.min(Math.floor(Game.cookies).toString().length,12); i++) {
      startingValue += '6';
      rollingEstimate += 0.1 * remainingProbability * startingValue;
      remainingProbability -= remainingProbability * 0.1;
    }
    rollingEstimate += remainingProbability * startingValue;
//    base_golden += 10655700000;
    base_golden += rollingEstimate * 0.0033;
    base_wrath += rollingEstimate * 0.0595;
  }
  if (useCurrent && Game.cookies < maxLuckyValue() * 10) {
    if (lucky_mod) {
      base_golden -= ((1200 * cps) - Math.min(1200 * cps, Game.cookies * 0.1)) * 0.49 * 0.5 + (maxLuckyValue() - (Game.cookies * 0.1)) * 0.49 * 0.5;
    } else {
      base_golden -= (maxLuckyValue() - (Game.cookies * 0.1)) * 0.49;
      base_wrath  -= (maxLuckyValue() - (Game.cookies * 0.1)) * 0.29;
    }
  }
  return Game.elderWrath / 3.0 * base_wrath + (3 - Game.elderWrath) / 3.0 * base_golden;
}

function maxLuckyValue() {
  var gcMod = Game.Has('Get lucky') ? 8400 : 1200;
  return baseCps() * gcMod;
}

function maxCookieTime() {
  return Game.goldenCookie.maxTime
}

function gcPs(gcValue) {
  var averageGCTime = probabilitySpan('golden', 0, 0.5) / Game.fps;
  gcValue /= averageGCTime;
  gcValue *= FrozenCookies.simulatedGCPercent;
  return gcValue;
}

function gcEfficiency() {
  if (gcPs(weightedCookieValue()) <= 0) {
    return Number.MAX_VALUE;
  }
  var cost = Math.max(0,(maxLuckyValue() * 10 - Game.cookies));
  var deltaCps = gcPs(weightedCookieValue() - weightedCookieValue(true));
  return divCps(cost, deltaCps);
}

function delayAmount() {
  return bestBank(nextChainedPurchase().efficiency).cost;
/*
  if (nextChainedPurchase().efficiency > gcEfficiency() || (Game.frenzy && Game.Has('Get lucky'))) {
    return maxLuckyValue() * 10;
  } else if (weightedCookieValue() > weightedCookieValue(true)) {
    return Math.min(maxLuckyValue() * 10, Math.max(0,(nextChainedPurchase().efficiency - (gcEfficiency() * baseCps())) / gcEfficiency()));
  } else {
   return 0;
  }
*/
}

function haveAllHalloween() {
  return _.every(halloweenCookies, function(id) {return Game.UpgradesById[id].unlocked;});
}

function checkPrices() {
  var value = 0;
  if (FrozenCookies.priceReductionTest && FrozenCookies.caches.recommendationList.length > 0) {
    var nextRec = FrozenCookies.caches.recommendationList.filter(function(i){return i.id != Game.Upgrades['Season savings'].id && i.id != Game.Upgrades['Toy workshop']})[0];
    value = (nextRec.cost / totalDiscount(nextRec.type == 'building')) - nextRec.cost;
  }
  return value;
}

// Use this for changes to future efficiency calcs
function purchaseEfficiency(price, deltaCps, baseDeltaCps, currentCps) {
  var efficiency = Number.POSITIVE_INFINITY;
  if (deltaCps > 0) {
    efficiency = FrozenCookies.efficiencyWeight * divCps(price, currentCps) + divCps(price, deltaCps);
  }
  return efficiency;
}

function recommendationList(recalculate) {
  if (recalculate) {
    FrozenCookies.caches.recommendationList = addScores(upgradeStats(recalculate).concat(buildingStats(recalculate)).concat(santaStats()).sort(function(a,b){return (a.efficiency - b.efficiency)}));
  }
  return FrozenCookies.caches.recommendationList;
//  return upgradeStats(recalculate).concat(buildingStats(recalculate)).sort(function(a,b){return (a.efficiency - b.efficiency)});
}

function addScores(recommendations) {
  var filteredList = recommendations.filter(function(a){return a.efficiency < Number.POSITIVE_INFINITY && a.efficiency > Number.NEGATIVE_INFINITY;})
  if (filteredList.length > 0) {
    var minValue = Math.log(recommendations[0].efficiency);
    var maxValue = Math.log(recommendations[filteredList.length - 1].efficiency);
    var spread = maxValue - minValue;
    recommendations.forEach(function(purchaseRec, index){
      if (purchaseRec.efficiency < Number.POSITIVE_INFINITY && purchaseRec.efficiency > Number.NEGATIVE_INFINITY) {
        var purchaseValue = Math.log(purchaseRec.efficiency);
        var purchaseSpread = purchaseValue - minValue;
        recommendations[index].efficiencyScore = 1 - (purchaseSpread / spread);
      } else {
        recommendations[index].efficiencyScore = 0;
      }
    });
  } else {
    recommendations.forEach(function(purchaseRec,index){recommendations[index].efficiencyScore = 0;});
  }
  return recommendations;
}

function nextPurchase(recalculate) {
  if (recalculate) {
    var recList = recommendationList(recalculate);
    var purchase = null;
    for (var i = 0; i < recList.length; i++) {
      var target = recList[i];
      if (target.type == 'upgrade' && unfinishedUpgradePrereqs(Game.UpgradesById[target.id])) {
        var prereqList = unfinishedUpgradePrereqs(Game.UpgradesById[target.id]);
        purchase = recList.filter(function(a){return prereqList.some(function(b){return b.id == a.id && b.type == a.type})})[0];
      } else {
        purchase = target;
      }
      if (purchase) {
        FrozenCookies.caches.nextPurchase = purchase;
        FrozenCookies.caches.nextChainedPurchase = target;
        break;
      }
    }
  }
  return FrozenCookies.caches.nextPurchase;
//  return purchase;
}

function nextChainedPurchase(recalculate) {
  nextPurchase(recalculate);
  return FrozenCookies.caches.nextChainedPurchase;
}

function buildingStats(recalculate) {
  if (recalculate) {
    var buildingBlacklist = blacklist[FrozenCookies.blacklist].buildings;
    var currentBank = bestBank(0).cost;
    FrozenCookies.caches.buildings = Game.ObjectsById.map(function (current, index) {
      if (buildingBlacklist === true || _.contains(buildingBlacklist, current.id)) {
        return null;
      }
      var baseCpsOrig = baseCps();
      var cpsOrig = effectiveCps(Math.min(Game.cookies, currentBank)); // baseCpsOrig + gcPs(cookieValue(Math.min(Game.cookies, currentBank))) + baseClickingCps(FrozenCookies.autoClick * FrozenCookies.cookieClickSpeed);
      var existingAchievements = Game.AchievementsById.map(function(item,i){return item.won});
      buildingToggle(current);
      var baseCpsNew = baseCps();
      var cpsNew = effectiveCps(currentBank); // baseCpsNew + gcPs(cookieValue(currentBank)) + baseClickingCps(FrozenCookies.autoClick * FrozenCookies.cookieClickSpeed);
      buildingToggle(current, existingAchievements);
      var deltaCps = cpsNew - cpsOrig;
      var baseDeltaCps = baseCpsNew - baseCpsOrig;
      var efficiency = purchaseEfficiency(current.getPrice(), deltaCps, baseDeltaCps, cpsOrig)
      return {'id' : current.id, 'efficiency' : efficiency, 'base_delta_cps' : baseDeltaCps, 'delta_cps' : deltaCps, 'cost' : current.getPrice(), 'purchase' : current, 'type' : 'building'};
    });
  }
  return FrozenCookies.caches.buildings;
}

function upgradeStats(recalculate) {
  if (recalculate) {
    var upgradeBlacklist = blacklist[FrozenCookies.blacklist].upgrades;
    var currentBank = bestBank(0).cost;
    FrozenCookies.caches.upgrades = Game.UpgradesById.map(function (current) {
      if (!current.bought) {
        var needed = unfinishedUpgradePrereqs(current);
        if (isUnavailable(current, upgradeBlacklist)) {
          return null;
        }
        var cost = upgradePrereqCost(current);
        var baseCpsOrig = baseCps();
        var cpsOrig = effectiveCps(Math.min(Game.cookies, currentBank)); // baseCpsOrig + gcPs(cookieValue(Math.min(Game.cookies, currentBank))) + baseClickingCps(FrozenCookies.autoClick * FrozenCookies.cookieClickSpeed);
        var existingAchievements = Game.AchievementsById.map(function(item){return item.won});
        var existingWrath = Game.elderWrath;
        var reverseFunctions = upgradeToggle(current);
        var baseCpsNew = baseCps();
        var cpsNew = effectiveCps(currentBank); // baseCpsNew + gcPs(cookieValue(currentBank)) + baseClickingCps(FrozenCookies.autoClick * FrozenCookies.cookieClickSpeed);
        var priceReductionTest = checkPrices();
        upgradeToggle(current, existingAchievements, reverseFunctions);
        Game.elderWrath = existingWrath;
        var deltaCps = cpsNew - cpsOrig;
        var baseDeltaCps = baseCpsNew - baseCpsOrig;
        var efficiency = (priceReductionTest > cost) ? 1 : purchaseEfficiency(cost, deltaCps, baseDeltaCps, cpsOrig)
        return {'id' : current.id, 'efficiency' : efficiency, 'base_delta_cps' : baseDeltaCps, 'delta_cps' : deltaCps, 'cost' : cost, 'purchase' : current, 'type' : 'upgrade'};
      }
    }).filter(function(a){return a;});
  }
  return FrozenCookies.caches.upgrades;
}

function isUnavailable(upgrade, upgradeBlacklist) {
  var result = false;
  if (!upgrade.unlocked) {
    var needed = unfinishedUpgradePrereqs(upgrade);
    result |= (upgradeBlacklist === true);
    result |= _.contains(upgradeBlacklist, upgrade.id);
    result |= !upgrade.unlocked && !needed;
    result |= (needed && _.find(needed, function(a){return a.type == "wrinklers"}) != null);
    result |= (upgrade.season && (Game.seasonT > Game.fps * 60 * 60 * 23));
  }
  return result;
}

function santaStats() {
  return Game.Has('A festive hat') && (Game.santaLevel + 1 < Game.santaLevels.length) ? {
    id: 0,
    efficiency: Infinity,
    base_delta_cps: 0,
    delta_cps: 0,
    cost: cumulativeSantaCost(1),
    type: 'santa',
    purchase: {
      id: 0,
      name: 'Santa Stage Upgrade (' + Game.santaLevels[(Game.santaLevel + 1) % Game.santaLevels.length] + ')',
      buy: buySanta,
      getCost: function() {return cumulativeSantaCost(1);}
    }
  } : [];
}

function totalDiscount(building) {                                                                                    
  var price = 1;
  if (Game.Has('Season savings') && building) price *= 0.99;
  if (Game.Has('Toy workshop') && !building) price *= 0.95;
  if (Game.Has('Santa\'s dominion')) price *= (building ? 0.99 : 0.98);
  return price;
}

function cumulativeBuildingCost(basePrice, startingNumber, endingNumber) {
  return basePrice * totalDiscount() * (Math.pow(Game.priceIncrease, endingNumber) - Math.pow(Game.priceIncrease, startingNumber)) / (Game.priceIncrease - 1);
}

function cumulativeSantaCost(amount) {
  var total = 0;
  if (!amount) {
  
  } else if (Game.santaLevel + amount < Game.santaLevels.length) {
    for (var i=Game.santaLevel + 1; i <= Game.santaLevel + amount; i++) {
      total += Math.pow(i, i);
    }
  } else if (amount < Game.santaLevels.length) {
    for (var i=Game.santaLevel + 1; i <= amount; i++) {
      total += Math.pow(i, i);
    }
  } else {
    total = Infinity;
  }
  return total;
}

function cumulativeSantaCost(amount) {
  var total = 0;
  if (!amount) {
    
  } else if (Game.santaLevel + amount < Game.santaLevels.length) {
    for (var i=Game.santaLevel + 1; i <= Game.santaLevel + amount; i++) {
      total += Math.pow(i, i);
    }
  } else if (amount < Game.santaLevels.length) {
    for (var i=Game.santaLevel + 1; i <= amount; i++) {
      total += Math.pow(i, i);
    }
  } else {
    total = Infinity;
  }
  return total;
}

function upgradePrereqCost(upgrade, full) {
  var cost = upgrade.getPrice();
  if (upgrade.unlocked) {
    return cost;
  }
  var prereqs = _.find(upgradeJson, function(a) {return a.id == upgrade.id;});
  if (prereqs) {
    cost += prereqs.buildings.reduce(function(sum,item,index) {
      var building = Game.ObjectsById[index];
      if (item && full) {
        sum += cumulativeBuildingCost(building.basePrice, 0, item);
      } else if (item && building.amount < item) {
        sum += cumulativeBuildingCost(building.basePrice, building.amount, item);
      }
      return sum;
    },0);
    cost += prereqs.upgrades.reduce(function(sum,item) {
      var reqUpgrade = Game.UpgradesById[item];
      if (!upgrade.bought || full) {
        sum += upgradePrereqCost(reqUpgrade, full);
      }
      return sum;
    }, 0);
    cost += cumulativeSantaCost(prereqs.santa);
  }
  return cost;
}

function unfinishedUpgradePrereqs(upgrade) {
  if (upgrade.unlocked) {
    return null;
  }
  var needed = [];
  var prereqs = _.find(upgradeJson, function(a) {return a.id == upgrade.id;});
  if (prereqs) {
    prereqs.buildings.forEach(function(a, b) {
      if (a && Game.ObjectsById[b].amount < a) {
        needed.push({'type' : 'building', 'id' : b});
      }
    });
    prereqs.upgrades.forEach(function(a) {
      if (!Game.UpgradesById[a].bought) {
        var recursiveUpgrade = Game.UpgradesById[a];
        var recursivePrereqs = unfinishedUpgradePrereqs(recursiveUpgrade);
        if (recursiveUpgrade.unlocked) {
          needed.push({'type' : 'upgrade', 'id' : a});
        } else if (!recursivePrereqs) {
          // Research is being done.
        } else {
          recursivePrereqs.forEach(function(a) {
            if (!needed.some(function(b){return b.id == a.id && b.type == a.type;})) {
              needed.push(a);
            }
          });
        }
      }
    });
    if (prereqs.santa) {
      needed.push({type:'santa', id: 0});
    }
    if (prereqs.wrinklers && Game.elderWrath == 0) {
      needed.push({type:'wrinklers', id:0});
    }
  }
  return needed.length ? needed : null;
}

function upgradeToggle(upgrade, achievements, reverseFunctions) {
  if (!achievements) {
    reverseFunctions = {};
    if (!upgrade.unlocked) {
      var prereqs = _.find(upgradeJson, function(a) {return a.id == upgrade.id;});
      if (prereqs) {
        reverseFunctions.prereqBuildings = [];
        prereqs.buildings.forEach(function(a,b) {
          var building = Game.ObjectsById[b];
          if (a && building.amount < a) {
            var difference = a - building.amount;
            reverseFunctions.prereqBuildings.push({id: b, amount: difference});
            building.amount += difference;
            building.bought += difference;
            Game.BuildingsOwned += difference;
          }
        });
        reverseFunctions.prereqUpgrades = [];
        if (prereqs.upgrades.length > 0) {
          prereqs.upgrades.forEach(function(id) {
            var upgrade = Game.UpgradesById[id];
            if (!upgrade.bought) {
              reverseFunctions.prereqUpgrades.push({id: id, reverseFunctions: upgradeToggle(upgrade)});
            }
          });
        }
      }
    }
    upgrade.bought = 1;
    Game.UpgradesOwned += 1;
    reverseFunctions.current = buyFunctionToggle(upgrade);
  } else {
    if (reverseFunctions.prereqBuildings) {
      reverseFunctions.prereqBuildings.forEach(function(b) {
        var building = Game.ObjectsById[b.id];
        building.amount -= b.amount;
        building.bought -= b.amount;
        Game.BuildingsOwned -= b.amount;
      });
    }
    if (reverseFunctions.prereqUpgrades) {
      reverseFunctions.prereqUpgrades.forEach(function(u) {
        var upgrade = Game.UpgradesById[u.id];
        upgradeToggle(upgrade, [], u.reverseFunctions);
      });
    }
    upgrade.bought = 0;
    Game.UpgradesOwned -= 1;
    buyFunctionToggle(reverseFunctions.current);
    Game.AchievementsOwned = 0;
    achievements.forEach(function(won, index){
      var achievement = Game.AchievementsById[index];
      achievement.won = won;
      if (won && achievement.hide < 3) {
        Game.AchievementsOwned += 1;
      }
    });
  }
  Game.recalculateGains = 1;
  Game.CalculateGains();
  return reverseFunctions;
}

function buildingToggle(building, achievements) {
  if (!achievements) {
    building.amount += 1;
    building.bought += 1;
    Game.BuildingsOwned += 1;
  } else {
    building.amount -= 1;
    building.bought -= 1;
    Game.BuildingsOwned -= 1;
    Game.AchievementsOwned = 0;
    achievements.forEach(function(won, index){
      var achievement = Game.AchievementsById[index];
      achievement.won = won;
      if (won && achievement.hide < 3) {
        Game.AchievementsOwned += 1;
      }
    });
  }
  Game.recalculateGains = 1;
  Game.CalculateGains();
}

function buyFunctionToggle(upgrade) {
  if (upgrade && !upgrade.length) {
    if (!upgrade.buyFunction) {
      return null;
    }
    
    var ignoreFunctions = [
      /Game\.Lock\('.*'\)/,
      /Game\.Unlock\(.*\)/,
      /Game\.Objects\['.*'\]\.drawFunction\(\)/,
      /Game\.SetResearch\('.*'\)/,
      /Game\.Upgrades\['.*'\]\.basePrice=.*/,
      /Game\.CollectWrinklers\(\)/,
//      /Game\.RefreshBuildings\(\)/,
//      /Game\.upgradesToRebuild=1/,
      /Game\.Popup\(.*\)/,
      /var drop=choose\(Game\.santaDrops\)/,
      /Game\.computeSeasonPrices\(\)/,
      /\S/
    ];
    var buyFunctions = upgrade.buyFunction.toString()
      .replace(/\n/g, '')
      .replace(/function\s*\(\)\s*{(.+)\s*}/, "$1")
      .replace(/for\s*\(.+\)\s*\{.+\}/,'')
      .replace(/if\s*\(this\.season\)\s*Game\.season=this\.season\;/,('Game.season="' + upgrade.season + '";'))
      .replace(/if\s*\(.+\)\s*[^{}]*?\;/,'')
      .replace(/if\s*\(.+\)\s*\{.+\}/,'')
      .replace(/\+\+/,'+=1')
      .replace(/\-\-/,'-=1')
      .replace(/Game\.RefreshBuildings\(\)/, 'FrozenCookies.priceReductionTest=true')
      .replace(/Game\.upgradesToRebuild=1/, 'FrozenCookies.priceReductionTest=true')
      .split(';')
      .map(function(a){return a.trim();})
      .filter(function(a){
        ignoreFunctions.forEach(function(b){a = a.replace(b,'')});
        return a != '';
      });
    
    if (buyFunctions.length == 0) {
      return null;
    }
    
    var reversedFunctions = buyFunctions.map(function(a){
      var reversed = '';
      var achievementMatch = /Game\.Win\('(.*)'\)/.exec(a);
      if (a.split('+=').length > 1) {
        reversed = a.split('+=').join('-=');
      } else if (a.split('-=').length > 1) {
        reversed = a.split('-=').join('+=');
      } else if (achievementMatch && Game.Achievements[achievementMatch[1]].won == 0) {
        reversed = 'Game.Achievements[\'' + achievementMatch[1] + '\'].won=0';
      } else if (a.split('=').length > 1) {
        var expression = a.split('=');
        var isString = expression[1].indexOf("'") > -1 || expression[1].indexOf('"') > -1;
        reversed = expression[0] + '=' + (isString ? "'" : '') + eval(expression[0]) + (isString ? "'" : ''); 
      }
      return reversed;
    });
    buyFunctions.forEach(function(f) {eval(f);});
    return reversedFunctions;
  } else if (upgrade && upgrade.length) {
    upgrade.forEach(function(f) {eval(f);});
  }
  return null;
}

function buySanta() {
  if (Game.LeftBackground) {
    Game.mouseX = 48;
    Game.mouseY = Game.LeftBackground.canvas.height-48-24;
    Game.Click = 1;
    Game.UpdateSanta();
    Game.Click = 0;
  }
}

function statSpeed() {
  var speed = 0;
  switch (FrozenCookies.trackStats) {
    case 1: // 60s
      speed = 1000 * 60; 
      break;
    case 2: // 30m
      speed = 1000 * 60 * 30;
      break;
    case 3: // 1h
      speed = 1000 * 60 * 60;
      break;
    case 4: // 24h
      speed = 1000 * 60 * 60 * 24;
      break;
  }
  return speed;
}

function saveStats(fromGraph) {
  FrozenCookies.trackedStats.push({
    time: Date.now() - Game.startDate,
    baseCps: baseCps(),
    effectiveCps: effectiveCps(),
    hc: Game.HowMuchPrestige(Game.cookiesEarned + Game.cookiesReset)
  });
  if ($('#statGraphContainer').length > 0 && !$('#statGraphContainer').is(':hidden') && !fromGraph) {
    viewStatGraphs();
  }
}

function viewStatGraphs() {
  saveStats(true);
  var containerDiv = $('#statGraphContainer').length ? 
    $('#statGraphContainer') : 
    $('<div>').attr('id', 'statGraphContainer')
      .html($('<div>')
      .attr('id', 'statGraphs'))
      .appendTo('body')
      .dialog({
        modal:true, 
        title: 'Frozen Cookies Tracked Stats',
        width:$(window).width() * 0.8, 
        height:$(window).height() * 0.8
      });
  if (containerDiv.is(':hidden')) {
    containerDiv.dialog();
  }
  if (FrozenCookies.trackedStats.length > 0 && (Date.now() - FrozenCookies.lastGraphDraw) > 1000) {
    FrozenCookies.lastGraphDraw = Date.now();
    $('#statGraphs').empty();
    var graphs = $.jqplot('statGraphs', transpose(FrozenCookies.trackedStats.map(function(s) {return [[s.time / 1000, s.baseCps], [s.time / 1000, s.effectiveCps], [s.time / 1000, s.hc]]})),  // 
      {
        legend: {show: true},
        height: containerDiv.height() - 50,
        axes: {
          xaxis: {
            tickRenderer: $.jqplot.CanvasAxisTickRenderer,
            tickOptions: {
              angle: -30,
              fontSize: '10pt',
              showGridline: false,
              formatter: function(ah,ai) {return timeDisplay(ai);}
            }
          },
          yaxis: {
            padMin: 0,
            renderer: $.jqplot.LogAxisRenderer,
            tickDistribution: 'even',
            tickOptions: {
              formatter: function(ah,ai) {return Beautify(ai);}
            }
          },
          y2axis: {
            padMin: 0,
            tickOptions: {
              showGridline: false,
              formatter: function(ah,ai) {return Beautify(ai);}
            }
          }
        },
        highlighter: {
          show: true,
          sizeAdjust: 15
        },
        series: [{label: 'Base CPS'},{label:'Effective CPS'},{label:'Earned HC', yaxis: 'y2axis'}]
      });
  }
}

function doTimeTravel() {
//  'Time Travel DISABLED','Purchases by Estimated Effective CPS','Purchases by Simulated Real Time','Heavenly Chips by Estimated Effective CPS','Heavenly Chips by Simulated Real Time'
  if (FrozenCookies.timeTravelMethod) {
    // Estimated Effective CPS
    if (timeTravelMethod % 2 === 1) {
      var fullCps = effectiveCps();
      if (fullCps) {
        var neededCookies = 0;
        if (timeTravelMethod === 1) {

        } else if (timeTravelMethod === 3) {
        
        }
      }
    } else {
    
    }
  } else {
    FrozenCookies.timeTravelAmount = 0;
  }
/*
  var fullCps = effectiveCps();
  if (fullCps > 0) {
    var neededCookies = Math.max(0, recommendation.cost + delayAmount() - Game.cookies);
    var time = neededCookies / fullCps;
    Game.Earn(neededCookies);
    Game.startDate -= time * 1000;
    Game.fullDate -= time * 1000;
    FrozenCookies.timeTravelPurchases -= 1;
    logEvent('Time travel', 'Travelled ' + timeDisplay(time) + ' into the future.');
  }
*/
}

function fcWin(what) {
  if (typeof what==='string') {
    if (Game.Achievements[what]) {
      if (Game.Achievements[what].won==0) {
        Game.Achievements[what].won=1;
        if (!FrozenCookies.disabledPopups) {
          logEvent('Achievement', 'Achievement unlocked :<br>'+Game.Achievements[what].name+'<br> ', true);
        }
        if (Game.Achievements[what].hide!=3) {
          Game.AchievementsOwned++;
        }
        Game.recalculateGains=1;
      }
    }
  } else {
    for (var i in what) {Game.Win(what[i]);}
  }
}

function logEvent(event, text, popup) {
  var time = '[' + timeDisplay((Date.now() - Game.startDate)/1000) + ']';
  var output = time + ' ' + event + ': ' + text;
  if (FrozenCookies.logging) {
    console.log(output);
  }
  if (popup) {
    Game.Popup(text);
  }
}

function inRect(x,y,rect) {
	// Duplicate of internally defined method, 
	// only needed because I'm modifying the scope of Game.UpdateWrinklers and it can't see this anymore.
	var dx = x+Math.sin(-rect.r)*(-(rect.h/2-rect.o)),dy=y+Math.cos(-rect.r)*(-(rect.h/2-rect.o));
	var h1 = Math.sqrt(dx*dx + dy*dy);
	var currA = Math.atan2(dy,dx);
	var newA = currA - rect.r;
	var x2 = Math.cos(newA) * h1;
	var y2 = Math.sin(newA) * h1;
	return (x2 > -0.5 * rect.w && x2 < 0.5 * rect.w && y2 > -0.5 * rect.h && y2 < 0.5 * rect.h);
}

function transpose(a) {
  return Object.keys(a[0]).map(function (c) { return a.map(function (r) { return r[c]; }); });
}

function smartTrackingStats(delay) {
  saveStats();
  if (FrozenCookies.trackStats == 6) {
    delay /= (FrozenCookies.delayPurchaseCount == 0) ? (1/1.5) : (delay > FrozenCookies.minDelay ? 2 : 1);
    FrozenCookies.smartTrackingBot = setTimeout(function(){smartTrackingStats(delay);}, delay);
    FrozenCookies.delayPurchaseCount = 0;
  }
}

// Unused
function shouldClickGC() {
  return Game.goldenCookie.life > 0 && FrozenCookies.autoGC;
}

// Unused
function autoGoldenCookie() {
  if (!FrozenCookies.processing && Game.goldenCookie.life) {
    FrozenCookies.processing = true;
    Game.goldenCookie.click();
    FrozenCookies.processing = false;
  }
}

function autoFrenzyClick() {
  if (Game.clickFrenzy > 0 && !FrozenCookies.autoFrenzyBot) {
    if (FrozenCookies.autoclickBot) {
      clearInterval(FrozenCookies.autoclickBot);
      FrozenCookies.autoclickBot = 0;
    }
    FrozenCookies.autoFrenzyBot = setInterval(function(){Game.ClickCookie();}, 1000 / FrozenCookies.frenzyClickSpeed);
  } else if (Game.clickFrenzy == 0 && FrozenCookies.autoFrenzyBot) {
    clearInterval(FrozenCookies.autoFrenzyBot);
    FrozenCookies.autoFrenzyBot = 0;
    if (FrozenCookies.autoClick && FrozenCookies.cookieClickSpeed) {
      FrozenCookies.autoclickBot = setInterval(function(){Game.ClickCookie();}, 1000 / FrozenCookies.cookieClickSpeed);
    }
  }
}

function autoCookie() {
  if (!FrozenCookies.processing) {
    FrozenCookies.processing = true;
    var currentHCAmount = Game.HowMuchPrestige(Game.cookiesEarned + Game.cookiesReset);
    if (FrozenCookies.lastHCAmount < currentHCAmount) {
      var changeAmount = currentHCAmount - FrozenCookies.lastHCAmount;
      FrozenCookies.lastHCAmount = currentHCAmount;
      FrozenCookies.prevLastHCTime = FrozenCookies.lastHCTime;
      FrozenCookies.lastHCTime = Date.now();
      var currHCPercent = (60 * 60 * (FrozenCookies.lastHCAmount - Game.prestige['Heavenly chips'])/((FrozenCookies.lastHCTime - Game.startDate)/1000));
      if ((Game.prestige['Heavenly chips'] < (currentHCAmount - changeAmount)) && currHCPercent > FrozenCookies.maxHCPercent) {
        FrozenCookies.maxHCPercent = currHCPercent;
      }
      var maxStr = (FrozenCookies.maxHCPercent === currHCPercent) ? ' (!)' : '';
      if (Game.frenzy === 0) {
        logEvent('HC', 'Gained ' + changeAmount + ' Heavenly Chips in ' + timeDisplay((FrozenCookies.lastHCTime - FrozenCookies.prevLastHCTime)/1000) + '.' + maxStr + ' Overall average: ' + currHCPercent + ' HC/hr.');
      } else {
        FrozenCookies.hcs_during_frenzy += changeAmount;
      }
      updateLocalStorage();
    }
    if (FrozenCookies.lastCPS != Game.cookiesPs) {
      FrozenCookies.recalculateCaches = true;
      FrozenCookies.lastCPS = Game.cookiesPs;
    }
    var recommendation = nextPurchase(FrozenCookies.recalculateCaches);
    FrozenCookies.recalculateCaches = false;
    var currentBank = bestBank(0);
    if (FrozenCookies.currentBank.cost != currentBank.cost) {
      FrozenCookies.recalculateCaches = true;
      FrozenCookies.currentBank = currentBank;
    }
    var targetBank = bestBank(recommendation.efficiency);
    if (FrozenCookies.targetBank.cost != targetBank.cost) {
      FrozenCookies.recalculateCaches = true;
      //logEvent('Bank', 'Target Bank level changed to ' + Beautify(targetBank.cost) + ' cookies.');
      FrozenCookies.targetBank = targetBank;
    }
    var currentCookieCPS = gcPs(cookieValue(currentBank.cost));
    if (FrozenCookies.lastCookieCPS != currentCookieCPS) {
      FrozenCookies.recalculateCaches = true;
      FrozenCookies.lastCookieCPS = currentCookieCPS;
    }
    var currentUpgradeCount = Game.UpgradesInStore.length;
    if (FrozenCookies.lastUpgradeCount != currentUpgradeCount) {
      FrozenCookies.recalculateCaches = true;
      FrozenCookies.lastUpgradeCount = currentUpgradeCount;
    }
    if (FrozenCookies.recalculateCaches) {
      //logEvent('Cache', 'Recalculating cached values.');
      recommendation = nextPurchase(FrozenCookies.recalculateCaches);
      FrozenCookies.recalculateCaches = false;
    }
    if (FrozenCookies.timeTravelAmount) {
      doTimeTravel();
    }
    if (FrozenCookies.autoWrinkler) {
      var popCount = 0;
      if (!haveAllHalloween()) {
        Game.wrinklers.forEach(function(w) {
          if (w.sucked > 0.5 && w.phase > 0) {
            w.hp = 0;
            popCount += 1;
          }
        });
        if (popCount) {
          logEvent('Wrinkler', 'Popped ' + popCount + ' wrinklers in attempt to gain cookies.');
        }
      } else if (Game.wrinklers.reduce(function(sum,w) {return sum + w.sucked * 1.1;}, 0) + Game.cookies >= delayAmount + recommendation.cost) {
        Game.wrinklers.forEach(function(w) {
          if (w.phase) {
            w.hp = 0;
            popCount += 1;
          }
        });
        if (popCount) {
          logEvent('Wrinkler', 'Popped ' + popCount + ' wrinklers to make a purchase.');
        }
      }
    }
    
    if (FrozenCookies.autoBuy && (Game.cookies >= delayAmount() + recommendation.cost) && (nextChainedPurchase().delta_cps >= 0)) {
//    if (FrozenCookies.autoBuy && (Game.cookies >= delayAmount() + recommendation.cost)) {
      recommendation.time = Date.now() - Game.startDate;
//      full_history.push(recommendation);  // Probably leaky, maybe laggy?
      recommendation.purchase.clickFunction = null;
      disabledPopups = false;
//      console.log(purchase.name + ': ' + Beautify(recommendation.efficiency) + ',' + Beautify(recommendation.delta_cps));
      recommendation.purchase.buy();
      if (FrozenCookies.trackStats == 5 && recommendation.type == 'upgrade') {
        saveStats();
      } else if (FrozenCookies.trackStats == 6) {
        FrozenCookies.delayPurchaseCount += 1;
      }
      logEvent('Store', 'Autobought ' + recommendation.purchase.name + ' for ' + Beautify(recommendation.cost) + ', resulting in ' + Beautify(recommendation.delta_cps) + ' CPS.');
      disabledPopups = true;
      FrozenCookies.recalculateCaches = true;
      FrozenCookies.processing = false;
      return autoCookie();
    }
    
    // This apparently *has* to stay here, or else fast purchases will multi-click it.
    if (Game.goldenCookie.life && FrozenCookies.autoGC) {
      Game.goldenCookie.click();
    }
    if (Game.seasonPopup.life > 0 && FrozenCookies.autoReindeer) {
      Game.seasonPopup.click();
    }
    if (FrozenCookies.autoBlacklistOff) {
      autoBlacklistOff();
    }
    if ((Game.frenzy > 0) != FrozenCookies.last_gc_state) {
      if (FrozenCookies.last_gc_state) {
      	logEvent('GC', 'Frenzy ended, cookie production back to normal.');
        logEvent('HC', 'Frenzy won ' + FrozenCookies.hcs_during_frenzy + ' heavenly chips');
        FrozenCookies.hcs_during_frenzy = 0;
        FrozenCookies.gc_time += Date.now() - FrozenCookies.last_gc_time;
      } else {
        FrozenCookies.non_gc_time += Date.now() - FrozenCookies.last_gc_time;
      }
      updateLocalStorage();
      FrozenCookies.last_gc_state = (Game.frenzy > 0);
      FrozenCookies.last_gc_time = Date.now();
    }
    FrozenCookies.processing = false;
  }
}

function FCStart() {
  //  To allow polling frequency to change, clear intervals before setting new ones.
  
  if (FrozenCookies.cookieBot) {
    clearInterval(FrozenCookies.cookieBot);
    FrozenCookies.cookieBot = 0;
  }
  if (FrozenCookies.autoclickBot) {
    clearInterval(FrozenCookies.autoclickBot);
    FrozenCookies.autoclickBot = 0;
  }
  if (FrozenCookies.statBot) {
    clearInterval(FrozenCookies.statBot);
    FrozenCookies.statBot = 0;
  }
  
  if (!FrozenCookies.saveWrinklers && localStorage.wrinklers) {
    delete localStorage.wrinklers;
  }

// Remove until timing issues are fixed
//  if (FrozenCookies.goldenCookieBot) {
//    clearInterval(FrozenCookies.goldenCookieBot);
//    FrozenCookies.goldenCookieBot = 0;
//  }
  
  // Now create new intervals with their specified frequencies.
  
  if (FrozenCookies.frequency) {
    FrozenCookies.cookieBot = setInterval(autoCookie, FrozenCookies.frequency);
  }
  
//  if (FrozenCookies.autoGC) {
//    FrozenCookies.goldenCookieBot = setInterval(autoGoldenCookie, FrozenCookies.frequency);
//  }
  
  if (FrozenCookies.autoClick && FrozenCookies.cookieClickSpeed) {
    FrozenCookies.autoclickBot = setInterval(Game.ClickCookie, 1000 / FrozenCookies.cookieClickSpeed);
  }
  
  if (FrozenCookies.autoFrenzy && FrozenCookies.frenzyClickSpeed) {
    FrozenCookies.frenzyClickBot = setInterval(autoFrenzyClick, FrozenCookies.frequency);
  }
  
  if (statSpeed(FrozenCookies.trackStats) > 0) {
    FrozenCookies.statBot = setInterval(saveStats, statSpeed(FrozenCookies.trackStats));
  } else if (FrozenCookies.trackStats == 6 && !FrozenCookies.smartTrackingBot) {
    FrozenCookies.smartTrackingBot = setTimeout(function() {smartTrackingStats(FrozenCookies.minDelay * 8)}, FrozenCookies.minDelay);
  }
  
  FCMenu();
}
