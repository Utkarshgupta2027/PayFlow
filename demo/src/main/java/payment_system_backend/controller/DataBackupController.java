package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.service.DataBackupService;

import java.time.LocalDate;
import java.util.Map;

@RestController
  @RequestMapping("/admin/backup")
  @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ADMIN')")
  public class DataBackupController {

    @Autowired
        private DataBackupService dataBackupService;

    @GetMapping("/export")
        public ResponseEntity<Map<String, Object>> exportBackup() {
                  Map<String, Object> backup = dataBackupService.exportFullBackup();
                  String filename = "payflow-backup-" + LocalDate.now() + ".json";
                  return ResponseEntity.ok()
                                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .body(backup);
        }

    @PostMapping("/restore")
        public ResponseEntity<Map<String, Object>> restoreBackup(@RequestBody Map<String, Object> backupData) {
                  try {
                                Map<String, Object> result = dataBackupService.restoreFromBackup(backupData);
                                return ResponseEntity.ok(result);
                  } catch (Exception e) {
                                return ResponseEntity.internalServerError()
                                                      .body(Map.of("status", "ERROR", "message", "Restore failed: " + e.getMessage()));
                  }
        }

    @GetMapping("/stats")
        public ResponseEntity<Map<String, Object>> getStats() {
                  return ResponseEntity.ok(dataBackupService.getBackupStats());
        }
  }
