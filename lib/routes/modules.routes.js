import { Router } from 'express';
import { wrap } from '../middleware/asyncHandler.js';
import { actorMiddleware } from '../middleware/actor.js';
import * as modulesCtrl from '../controllers/modules.controller.js';
import * as groupsCtrl from '../controllers/groups.controller.js';

const router = Router();

router.use(actorMiddleware);

// Module CRUD
router.get('/modules', wrap(modulesCtrl.list));
router.post('/modules', wrap(modulesCtrl.create));
router.get('/modules/:id', wrap(modulesCtrl.getOne));
router.put('/modules/:id', wrap(modulesCtrl.update));
router.delete('/modules/:id', wrap(modulesCtrl.remove));

// Module actions
router.post('/modules/:id/duplicate', wrap(modulesCtrl.duplicate));
router.post('/modules/:id/merge', wrap(modulesCtrl.merge));

// Group CRUD
router.post('/modules/:id/groups', wrap(groupsCtrl.add));
router.put('/modules/:id/groups/:groupId', wrap(groupsCtrl.update));
router.delete('/modules/:id/groups/:groupId', wrap(groupsCtrl.remove));

// Group actions
router.post('/modules/:id/groups/:groupId/duplicate', wrap(groupsCtrl.duplicate));
router.put('/modules/:id/groups/:groupId/evaluation', wrap(groupsCtrl.updateEvaluation));

export default router;
