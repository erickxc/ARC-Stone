from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/logs", tags=["Logs de Auditoria"])

@router.get("/", response_model=list[schemas.AuditLogOut])
def listar_logs(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Retorna os logs do sistema. Admins veem todos. Vendedores veem apenas ações em seus orçamentos. """
    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.usuario))
    
    if current_user.role != 'admin':
        # Vendedores só veem logs onde a entidade afetada pertence a eles
        query = query.filter(models.AuditLog.vendedor_id == current_user.id)
        
    logs = query.order_by(models.AuditLog.created_at.desc()).limit(100).all()
    
    # Enriquecer o nome de quem fez a ação lendo da memória
    for log in logs:
        log.usuario_nome = log.usuario.nome if log.usuario else "Sistema"
        
    return logs
