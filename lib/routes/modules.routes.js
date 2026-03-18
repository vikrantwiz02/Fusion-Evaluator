import { Router } from 'express';
import { wrap } from '../middleware/asyncHandler.js';
import { actorMiddleware } from '../middleware/actor.js';
import * as modulesCtrl from '../controllers/modules.controller.js';
import * as groupsCtrl from '../controllers/groups.controller.js';
import * as divisionsCtrl from '../controllers/divisions.controller.js';

const router = Router();

router.use(actorMiddleware);

// ── Bulk operations (must be declared BEFORE /:id routes to avoid param capture) ──
router.put('/modules/bulk-timer', wrap(modulesCtrl.bulkTimer));

// Module CRUD
router.get('/modules', wrap(modulesCtrl.list));
router.post('/modules', wrap(modulesCtrl.create));
router.get('/modules/:id', wrap(modulesCtrl.getOne));
router.put('/modules/:id', wrap(modulesCtrl.update));
router.delete('/modules/:id', wrap(modulesCtrl.remove));

// Module actions
router.post('/modules/:id/duplicate', wrap(modulesCtrl.duplicate));
router.post('/modules/:id/merge', wrap(modulesCtrl.merge));
router.get('/modules/:id/specifications', wrap(modulesCtrl.getSpecifications));
router.put('/modules/:id/specifications', wrap(modulesCtrl.updateSpecifications));

// Division CRUD (admin only — enforced in service layer)
router.get('/modules/:id/divisions', wrap(divisionsCtrl.list));
router.post('/modules/:id/divisions', wrap(divisionsCtrl.create));
router.put('/modules/:id/divisions/:divisionId', wrap(divisionsCtrl.update));
router.delete('/modules/:id/divisions/:divisionId', wrap(divisionsCtrl.remove));

// Group CRUD
router.post('/modules/:id/groups', wrap(groupsCtrl.add));
router.put('/modules/:id/groups/:groupId', wrap(groupsCtrl.update));
router.delete('/modules/:id/groups/:groupId', wrap(groupsCtrl.remove));

// Group actions
router.post('/modules/:id/groups/:groupId/duplicate', wrap(groupsCtrl.duplicate));
router.put('/modules/:id/groups/:groupId/evaluation', wrap(groupsCtrl.updateEvaluation));

export default router;
