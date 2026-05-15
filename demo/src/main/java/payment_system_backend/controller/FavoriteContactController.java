package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.FavoriteContact;
import payment_system_backend.model.User;
import payment_system_backend.repository.FavoriteContactRepository;
import payment_system_backend.repository.UserRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/contacts")
public class FavoriteContactController {

    @Autowired
    private FavoriteContactRepository contactRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> list(Authentication authentication) {
        try {
            User owner = currentUser(authentication);
            List<Map<String, Object>> contacts = contactRepository.findByOwnerIdOrderByCreatedAtDesc(owner.getId())
                    .stream()
                    .map(this::toResponse)
                    .toList();
            return ResponseEntity.ok(contacts);
        } catch (RuntimeException ex) {
            return ResponseEntity.status(401).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody Map<String, String> body,
                                 Authentication authentication) {
        try {
            User owner = currentUser(authentication);
            String identifier = body.get("recipientIdentifier");
            String nickname = body.get("nickname");
            if (identifier == null || identifier.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Recipient ID, email, or phone is required."));
            }

            User recipient = resolveUser(identifier.trim());
            if (recipient == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Recipient not found."));
            }
            if (recipient.getId().equals(owner.getId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "You cannot add yourself as a favourite."));
            }

            FavoriteContact contact = contactRepository
                    .findByOwnerIdAndContactUserId(owner.getId(), recipient.getId())
                    .orElseGet(FavoriteContact::new);
            contact.setOwnerId(owner.getId());
            contact.setContactUserId(recipient.getId());
            contact.setNickname(nickname == null || nickname.isBlank() ? null : nickname.trim());
            FavoriteContact saved = contactRepository.save(contact);
            return ResponseEntity.ok(toResponse(saved));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        try {
            User owner = currentUser(authentication);
            FavoriteContact contact = contactRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Contact not found."));
            if (!contact.getOwnerId().equals(owner.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You can only remove your own contacts."));
            }
            contactRepository.delete(contact);
            return ResponseEntity.ok(Map.of("message", "Contact removed."));
        } catch (RuntimeException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    private Map<String, Object> toResponse(FavoriteContact contact) {
        User recipient = userRepository.findById(contact.getContactUserId()).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("id", contact.getId());
        response.put("contactUserId", contact.getContactUserId());
        response.put("nickname", contact.getNickname());
        response.put("createdAt", contact.getCreatedAt());
        if (recipient != null) {
            response.put("name", recipient.getName());
            response.put("email", recipient.getEmail());
            response.put("phoneNumber", recipient.getPhoneNumber());
            response.put("profilePictureUrl", recipient.getProfilePictureUrl());
        }
        return response;
    }

    private User resolveUser(String input) {
        if (input.contains("@")) {
            return userRepository.findByEmail(input);
        }
        try {
            Long id = Long.parseLong(input);
            User byId = userRepository.findById(id).orElse(null);
            if (byId != null) return byId;
        } catch (NumberFormatException ignored) {
        }
        return userRepository.findByPhoneNumber(input);
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Authentication required");
        }
        User user = userRepository.findByEmail(authentication.getName());
        if (user == null) {
            user = userRepository.findByPhoneNumber(authentication.getName());
        }
        if (user == null) {
            throw new RuntimeException("Authenticated user not found");
        }
        return user;
    }
}
