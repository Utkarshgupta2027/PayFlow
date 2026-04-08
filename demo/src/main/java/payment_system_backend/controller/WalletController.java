package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.dto.AddMoneyRequest;
import payment_system_backend.model.User;
import payment_system_backend.service.WalletService;

@RestController
@RequestMapping("/wallet")
public class WalletController {
    @GetMapping("/run")
    public String test(){
        return "Backend is running";
    }

    @Autowired
    private WalletService walletService;

    @PostMapping("/addMoney")
    public User addMoney(@RequestBody AddMoneyRequest request){

        return walletService.addMoney(request.getUserId(), request.getAmount());
    }
}