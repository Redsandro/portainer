angular.module('portainer')
.run(['$rootScope', '$state', 'Authentication', 'authManager', 'StateManager', 'EndpointProvider', 'Notifications', 'Analytics', 'cfpLoadingBar', function ($rootScope, $state, Authentication, authManager, StateManager, EndpointProvider, Notifications, Analytics, cfpLoadingBar) {
  'use strict';

  EndpointProvider.initialize();

  StateManager.initialize()
  .then(function success(state) {
    if (state.application.authentication) {
      initAuthentication(authManager, Authentication, $rootScope);
    }
    if (state.application.analytics) {
      initAnalytics(Analytics, $rootScope);
    }
  })
  .catch(function error(err) {
    Notifications.error('Failure', err, 'Unable to retrieve application settings');
  });

  $rootScope.$state = $state;

  // Workaround to prevent the loading bar from going backward
  // https://github.com/chieffancypants/angular-loading-bar/issues/273
  var originalSet = cfpLoadingBar.set;
  cfpLoadingBar.set = function overrideSet(n) {
    if (n > cfpLoadingBar.status()) {
      originalSet.apply(cfpLoadingBar, arguments);
    }
  };

  $rootScope.Zoom = {
    Update: function(){ var x = (this.Current===undefined) ? 1 : this.Current; var z=this.Current/100; var c=100/z;
      this.Style = { 'height':c+'%', 'width':c+'%', 'overflow':'auto',
        '-webkit-transform':'scale('+z+')', '-moz-transform':'scale('+z+')', 'transform':'scale('+z+')',
        '-webkit-transform-origin':'0 0', '-moz-transform-origin':'0 0', 'transform-origin':'0 0' };
    },
    Current: 100, Clear: function(){ this.Current = 100; this.Update(); },
  };
  $rootScope.Zoom.Update();

}]);

function initAuthentication(authManager, Authentication, $rootScope) {
  authManager.checkAuthOnRefresh();
  authManager.redirectWhenUnauthenticated();
  Authentication.init();
  $rootScope.$on('tokenHasExpired', function() {
    $state.go('auth', {error: 'Your session has expired'});
  });
}

function initAnalytics(Analytics, $rootScope) {
  Analytics.offline(false);
  Analytics.registerScriptTags();
  Analytics.registerTrackers();
  $rootScope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState, fromParams) {
    Analytics.trackPage(toState.url);
    Analytics.pageView();
  });
}
