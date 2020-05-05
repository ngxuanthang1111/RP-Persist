/**
 * Create the store with dynamic reducers
 */

import { applyMiddleware, createStore, compose, Reducer } from 'redux';
import { routerMiddleware } from 'connected-react-router';
import { createInjectorsEnhancer, forceReducerReload } from 'redux-injectors';
import createSagaMiddleware from 'redux-saga';
import { History } from 'history';
import { composeWithDevTools } from 'redux-devtools-extension';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import localStorage from 'redux-persist/lib/storage';

import createReducer from './reducers';
import { InjectedStore, ApplicationRootState } from 'types';

export default function configureStore(
  initialState: ApplicationRootState | {} = {},
  history: History,
) {
  const reduxSagaMonitorOptions = {};
  const sagaMiddleware = createSagaMiddleware(reduxSagaMonitorOptions);
  const { run: runSaga } = sagaMiddleware;

  // Create the store with two middlewares
  // 1. sagaMiddleware: Makes redux-sagas work
  // 2. routerMiddleware: Syncs the location/URL path to the state
  const middlewares = [sagaMiddleware, routerMiddleware(history)];

  const enhancers = [
    applyMiddleware(...middlewares),
    createInjectorsEnhancer({
      createReducer,
      runSaga,
    }),
  ];

  let enhancer;
  // If Redux Dev Tools and Saga Dev Tools Extensions are installed, enable them
  /* istanbul ignore next */
  if (process.env.NODE_ENV !== 'production' && typeof window === 'object') {
    enhancer = composeWithDevTools(...enhancers);
    // NOTE: Uncomment the code below to restore support for Redux Saga
    // Dev Tools once it supports redux-saga version 1.x.x
    // if (window.__SAGA_MONITOR_EXTENSION__)
    //   reduxSagaMonitorOptions = {
    //     sagaMonitor: window.__SAGA_MONITOR_EXTENSION__,
    //   };
  } else {
    enhancer = compose(...enhancers);
  }

  const rootReducer: Reducer<any, any> = createReducer();

  const persistConfig: PersistConfig<ApplicationRootState> = {
    key: 'root',
    storage: localStorage,
    whitelist: ['language'],
  };

  const persistedReducer = persistReducer(persistConfig, rootReducer);

  const store = createStore(
    persistedReducer,
    initialState,
    enhancer,
  ) as InjectedStore;

  const persistor = persistStore(store);

  // Extensions
  store.runSaga = sagaMiddleware.run;
  store.injectedReducers = {}; // Reducer registry
  store.injectedSagas = {}; // Saga registry

  // Make reducers hot reloadable, see http://mxs.is/googmo
  /* istanbul ignore next */
  if (module.hot) {
    module.hot.accept('./reducers', () => {
      forceReducerReload(store);
      // set-up redux-persist
      const nextRootReducer: Reducer<any, any> = createReducer(
        store.injectedReducers,
      );
      store.replaceReducer(
        persistReducer(store.persistConfig, nextRootReducer),
      );
      store.persistor.persist();
    });
  }

  return { store, persistor };
}
