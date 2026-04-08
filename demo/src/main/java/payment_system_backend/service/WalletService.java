package payment_system_backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.User;
import payment_system_backend.repository.UserRepository;

@Service
public class WalletService {

    @Autowired
    private UserRepository userRepository;

    public User addMoney(Long userId, double amount){

        User user = userRepository.findById(userId).orElseThrow();

        user.setBalance(user.getBalance() + amount);

        return userRepository.save(user);
    }
}